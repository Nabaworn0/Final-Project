import { getCurrentUser } from "@/lib/server/auth";
import { CourseError } from "@/lib/server/course-store";
import { courseStore } from "@/lib/server/courses";
import { listMidtermCommittees, saveMidtermCommittee } from "@/lib/server/midterm-committees";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "คำขอไม่ได้มาจากเว็บไซต์นี้" }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
  if (actor.role !== "instructor") return Response.json({ error: "เฉพาะอาจารย์เท่านั้น" }, { status: 403 });
  try {
    const input = JSON.parse(await request.text()) as Record<string, unknown>;
    const courseId = typeof input.courseId === "string" ? input.courseId.trim() : "";
    const cohort = typeof input.cohort === "string" ? input.cohort.trim().toUpperCase() : "";
    const instructorId = typeof input.instructorId === "string" ? input.instructorId.trim() : "";
    const groupNumber = Number(input.groupNumber);
    const slot = Number(input.slot);
    if (!courseId || !["CED", "TCT"].includes(cohort) || ![1, 2].includes(groupNumber) || ![1, 2, 3].includes(slot)) return Response.json({ error: "ข้อมูลกลุ่มสอบไม่ถูกต้อง" }, { status: 400 });
    const workspace = await courseStore().workspace(actor, courseId);
    if (!workspace.canManage) return Response.json({ error: "เฉพาะอาจารย์ผู้รับผิดชอบรายวิชาเท่านั้นที่จัดกรรมการได้" }, { status: 403 });
    if (instructorId && !workspace.people.some(person => person.id === instructorId && person.role === "instructor")) return Response.json({ error: "ไม่พบอาจารย์ในรายวิชานี้" }, { status: 404 });
    if (instructorId) {
      const existing = await listMidtermCommittees(courseId, cohort);
      if (existing.some(item => item.groupNumber === groupNumber && item.slot !== slot && item.instructorId === instructorId)) return Response.json({ error: "อาจารย์คนนี้อยู่ในกลุ่มสอบนี้แล้ว" }, { status: 409 });
    }
    const saved = await saveMidtermCommittee({ courseId, cohort, groupNumber, slot, instructorId });
    return Response.json({ ok: true, ...saved });
  } catch (error) {
    if (error instanceof CourseError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
    console.error("Midterm committee failed", error);
    return Response.json({ error: "บันทึกกรรมการไม่สำเร็จ" }, { status: 500 });
  }
}
