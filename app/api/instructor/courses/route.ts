import { getCurrentUser } from "@/lib/server/auth";
import { CourseError } from "@/lib/server/course-store";
import { courseStore } from "@/lib/server/courses";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "คำขอไม่ได้มาจากเว็บไซต์นี้" }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  if (actor.role !== "instructor") return Response.json({ error: "ไม่มีสิทธิ์จัดการรายวิชา" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 256000) throw new CourseError("ข้อมูลยาวเกินกำหนด", 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new CourseError("รูปแบบข้อมูลไม่ถูกต้อง");
    return Response.json(await courseStore().mutate(actor, input));
  } catch (error) {
    if (error instanceof CourseError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) return Response.json({ error: "ข้อมูลซ้ำ: ตรวจสอบรหัสวิชาและภาคเรียน อีเมล รหัสนักศึกษา หรือชื่อห้อง" }, { status: 409 });
    console.error("Course operation failed", error);
    return Response.json({ error: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
