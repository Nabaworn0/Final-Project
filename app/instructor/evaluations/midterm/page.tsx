import Link from "next/link";
import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { MidtermCommitteeSelect } from "@/features/instructor/evaluations/components/midterm-committee-select";
import { requireRole } from "@/lib/server/auth";
import { courseStore } from "@/lib/server/courses";
import { listMidtermCommittees } from "@/lib/server/midterm-committees";
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
  const requested = (await searchParams).classroom?.toUpperCase();
  const selected: ClassroomCode | null = requested === "CED" || requested === "TCT" ? requested : null;
  const classrooms = ["CED", "TCT"] as const;
  const countStudents = (classroom: ClassroomCode) => workspaces.reduce((total, workspace) => total + workspace.people.filter(person => person.role === "student" && classroomCode(person.cohort) === classroom).length, 0);
  const primary = workspaces[0];
  const committees = selected && primary ? await listMidtermCommittees(primary.course.id, selected) : [];
  const teachers = primary?.people.filter(person => person.role === "instructor").map(person => ({ id: person.id, fullName: person.fullName })) || [];
  const students = selected ? workspaces.flatMap(workspace => workspace.people.filter(person => person.role === "student" && classroomCode(person.cohort) === selected).map(person => ({ ...person, courseId: workspace.course.id }))).sort((a, b) => (a.studentNumber || "").localeCompare(b.studentNumber || "", "th")) : [];
  const splitAt = Math.ceil(students.length / 2);
  const examGroups = [students.slice(0, splitAt), students.slice(splitAt)];

  return <InstructorShell title="สอบกลางภาค" userName={user.fullName} active="midterm"><div className="course-workspace midterm-workspace">
    <section className="course-current"><div><p className="card-label">MIDTERM EXAMINATION</p><h2>{selected ? `ห้องเรียน ${selected}` : "เลือกห้องเรียน"}</h2><p>{selected ? "แบ่งนักศึกษาเป็น 2 กลุ่มสอบ แต่ละกลุ่มมีกรรมการคุมสอบอย่างน้อย 3 คน" : "เลือก CED หรือ TCT เพื่อจัดกลุ่มสอบและกรรมการ"}</p></div>{selected && <Link className="solid-link" href="/instructor/evaluations/midterm">← เลือกห้องอื่น</Link>}</section>

    {!selected && <section className="classroom-picker" aria-labelledby="midterm-classroom-title"><div className="classroom-picker-heading"><p className="card-label">SELECT CLASSROOM</p><h3 id="midterm-classroom-title">ห้องสอบกลางภาค</h3><p>เลือกห้องเพื่อดู 2 กลุ่มสอบและกำหนดกรรมการ</p></div><div className="classroom-picker-grid">{classrooms.map(classroom => <Link className="classroom-choice-link" href={`/instructor/evaluations/midterm?classroom=${classroom}`} key={classroom}><span>{classroom}</span><small>นักศึกษา {countStudents(classroom)} คน</small><b>จัดกลุ่มสอบ →</b></Link>)}</div></section>}

    {selected && <>
      <section className="midterm-summary"><span>ห้องเรียน <strong>{selected}</strong></span><span>นักศึกษา <strong>{students.length} คน</strong></span><span>กลุ่มสอบ <strong>2 กลุ่ม</strong></span><span>กรรมการ <strong>3 คน / กลุ่ม</strong></span></section>
      <section className="midterm-group-grid">{examGroups.map((groupStudents, groupIndex) => {
        const groupNumber = groupIndex + 1;
        const assignedCount = committees.filter(item => item.groupNumber === groupNumber && item.instructorId).length;
        return <article className="midterm-group-card" key={groupNumber}><header><div><p className="card-label">EXAM GROUP {String(groupNumber).padStart(2, "0")}</p><h3>กลุ่มสอบที่ {groupNumber}</h3><span>นักศึกษา {groupStudents.length} คน</span></div><b className={assignedCount >= 3 ? "committee-ready" : "committee-incomplete"}>{assignedCount >= 3 ? "กรรมการครบแล้ว" : `รอกรรมการ ${3 - assignedCount} คน`}</b></header>
          <section className="committee-panel"><h4>อาจารย์คุมสอบ</h4><div>{[1, 2, 3].map(slot => <MidtermCommitteeSelect key={slot} courseId={primary?.course.id || ""} classroom={selected} groupNumber={groupNumber} slot={slot} teachers={teachers} initialValue={committees.find(item => item.groupNumber === groupNumber && item.slot === slot)?.instructorId || ""} canManage={Boolean(primary?.canManage)} />)}</div></section>
          <div className="course-table-wrap"><table><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ</th><th>สกุล</th></tr></thead><tbody>{!groupStudents.length && <tr><td className="sheet-empty-cell" colSpan={4}>ยังไม่มีนักศึกษาในกลุ่มสอบนี้</td></tr>}{groupStudents.map((student, index) => { const name = splitName(student.fullName); return <tr key={`${student.courseId}-${student.id}`}><td>{index + 1}</td><td>{student.studentNumber || "—"}</td><td>{name.firstName}</td><td>{name.lastName || "—"}</td></tr>; })}</tbody></table></div>
        </article>;
      })}</section>
    </>}
  </div></InstructorShell>;
}
