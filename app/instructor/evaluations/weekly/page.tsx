import Link from "next/link";
import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { WeeklyFeedbackTable, type WeeklyStudent } from "@/features/instructor/evaluations/components/weekly-feedback-table";
import { requireRole } from "@/lib/server/auth";
import { courseStore } from "@/lib/server/courses";
import { listWeeklyFeedback } from "@/lib/server/weekly-feedback";
import "@/features/instructor/courses/courses.css";

type ClassroomCode = "CED" | "TCT";

function classroomCode(value: string | null): ClassroomCode | "" {
  const normalized = value?.trim().toUpperCase() || "";
  if (normalized.includes("CED")) return "CED";
  if (normalized.includes("TCT")) return "TCT";
  return "";
}

function splitName(fullName: string) {
  const [firstName = "", ...lastName] = fullName.trim().split(/\s+/);
  return { firstName, lastName: lastName.join(" ") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ classroom?: string }> }) {
  const user = await requireRole("instructor");
  const store = courseStore();
  const courses = await store.listCourses(user);
  const workspaces = await Promise.all(courses.map(course => store.workspace(user, course.id)));
  const feedbackByCourse = new Map<string, Awaited<ReturnType<typeof listWeeklyFeedback>>>();
  await Promise.all(workspaces.map(async workspace => feedbackByCourse.set(workspace.course.id, await listWeeklyFeedback(workspace.course.id, user.id))));
  const requested = (await searchParams).classroom?.toUpperCase();
  const selected: ClassroomCode | null = requested === "CED" || requested === "TCT" ? requested : null;
  const classrooms = ["CED", "TCT"] as const;
  const countStudents = (classroom: ClassroomCode) => workspaces.reduce((total, workspace) => total + workspace.people.filter(person => person.role === "student" && classroomCode(person.cohort) === classroom).length, 0);

  const students: WeeklyStudent[] = selected ? workspaces.flatMap(workspace => workspace.people.filter(person => person.role === "student" && classroomCode(person.cohort) === selected).map(person => {
    const name = splitName(person.fullName);
    const membership = workspace.memberships.find(item => item.studentId === person.id && item.phase === "before_midterm");
    const room = workspace.rooms.find(item => item.id === membership?.roomId);
    const latest = feedbackByCourse.get(workspace.course.id)?.find(item => item.studentId === person.id);
    return { id: person.id, courseId: workspace.course.id, studentNumber: person.studentNumber || "", firstName: name.firstName, lastName: name.lastName, groupName: room?.name || "ยังไม่จัดกลุ่ม", feedback: latest ? { week: latest.week, comment: latest.comment, updatedAt: latest.updatedAt } : undefined };
  })).sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, "th")) : [];

  return <InstructorShell title="ซ้อมสอนรายสัปดาห์" userName={user.fullName} active="weekly"><div className="course-workspace weekly-practice-workspace">
    <section className="course-current"><div><p className="card-label">WEEKLY PRACTICE</p><h2>{selected ? `ห้องเรียน ${selected}` : "เลือกห้องเรียน"}</h2><p>{selected ? "เลือกรายชื่อนักศึกษาเพื่อให้ Feedback หรือเขียนคอมเมนต์จากการซ้อมสอน" : "เลือก CED หรือ TCT เพื่อเปิดรายชื่อนักศึกษาซ้อมสอน"}</p></div>{selected && <Link className="solid-link" href="/instructor/evaluations/weekly">← เลือกห้องอื่น</Link>}</section>
    {!selected && <section className="classroom-picker" aria-labelledby="weekly-classroom-title"><div className="classroom-picker-heading"><p className="card-label">SELECT CLASSROOM</p><h3 id="weekly-classroom-title">ห้องเรียนซ้อมสอน</h3><p>เลือกห้องเพื่อดูรายชื่อและบันทึก Feedback รายสัปดาห์</p></div><div className="classroom-picker-grid">{classrooms.map(classroom => <Link className="classroom-choice-link" href={`/instructor/evaluations/weekly?classroom=${classroom}`} key={classroom}><span>{classroom}</span><small>นักศึกษา {countStudents(classroom)} คน</small><b>เปิดรายชื่อ →</b></Link>)}</div></section>}
    {selected && <WeeklyFeedbackTable students={students} />}
  </div></InstructorShell>;
}
