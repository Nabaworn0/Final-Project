import { getCurrentUser } from "@/lib/server/auth";
import { CourseError } from "@/lib/server/course-store";
import { courseStore } from "@/lib/server/courses";
import { saveWeeklyFeedback } from "@/lib/server/weekly-feedback";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "คำขอไม่ได้มาจากเว็บไซต์นี้" }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  if (actor.role !== "instructor") return Response.json({ error: "เฉพาะอาจารย์เท่านั้น" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 12000) return Response.json({ error: "ข้อความยาวเกินกำหนด" }, { status: 413 });
    const input = JSON.parse(raw) as Record<string, unknown>;
    const courseId = typeof input.courseId === "string" ? input.courseId.trim() : "";
    const studentId = typeof input.studentId === "string" ? input.studentId.trim() : "";
    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    const week = Number(input.week);
    if (!courseId || !studentId || !comment || comment.length > 4000 || !Number.isInteger(week) || week < 1 || week > 20) return Response.json({ error: "กรุณาระบุสัปดาห์และ Feedback ให้ถูกต้อง" }, { status: 400 });
    const workspace = await courseStore().workspace(actor, courseId);
    if (!workspace.people.some(person => person.id === studentId && person.role === "student")) return Response.json({ error: "ไม่พบนักศึกษาในห้องที่รับผิดชอบ" }, { status: 404 });
    const saved = await saveWeeklyFeedback({ courseId, studentId, instructorId: actor.id, week, comment });
    return Response.json({ ok: true, ...saved });
  } catch (error) {
    if (error instanceof CourseError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    console.error("Weekly feedback failed", error);
    return Response.json({ error: "บันทึก Feedback ไม่สำเร็จ" }, { status: 500 });
  }
}
