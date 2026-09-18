import Link from "next/link";
import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { GroupInstructorSelect } from "@/features/instructor/courses/group-instructor-select";
import { AddStudentToGroup, StudentGroupSelect } from "@/features/instructor/courses/group-student-controls";
import type { CoursePerson, CourseWorkspace } from "@/features/instructor/courses/types";
import { requireRole } from "@/lib/server/auth";
import { courseStore } from "@/lib/server/courses";
import "@/features/instructor/courses/courses.css";

type ClassroomCode = "CED" | "TCT";
type StudentRecord = { person: CoursePerson; workspace: CourseWorkspace };

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

  return <InstructorShell title="อาจารย์ผู้รับผิดชอบ" userName={user.fullName} active="students"><div className="course-workspace responsible-workspace">
    <section className="course-current"><div><p className="card-label">RESPONSIBLE INSTRUCTORS</p><h2>{selected ? `ห้องเรียน ${selected}` : "เลือกห้องเรียน"}</h2><p>{selected ? "รายชื่อนักศึกษาแบ่งเป็น 4 กลุ่ม โดยมีอาจารย์ผู้รับผิดชอบกลุ่มละ 1 คน" : "เลือก CED หรือ TCT เพื่อดูการแบ่งกลุ่มและอาจารย์ผู้รับผิดชอบ"}</p></div>{selected && <Link className="solid-link" href="/instructor/students">← เลือกห้องอื่น</Link>}</section>

    {!selected && <section className="classroom-picker" aria-labelledby="responsible-classroom-title">
      <div className="classroom-picker-heading"><p className="card-label">SELECT CLASSROOM</p><h3 id="responsible-classroom-title">ห้องเรียน</h3><p>เลือกห้องเพื่อดูนักศึกษา 4 กลุ่มและอาจารย์ผู้รับผิดชอบ</p></div>
      <div className="classroom-picker-grid">{classrooms.map(classroom => <Link className="classroom-choice-link" href={`/instructor/students?classroom=${classroom}`} key={classroom}><span>{classroom}</span><small>นักศึกษา {countStudents(classroom)} คน</small><b>ดูการแบ่งกลุ่ม →</b></Link>)}</div>
    </section>}

    {selected && <ClassroomGroups classroom={selected} workspaces={workspaces} />}
  </div></InstructorShell>;
}

function ClassroomGroups({ classroom, workspaces }: { classroom: ClassroomCode; workspaces: CourseWorkspace[] }) {
  const students: StudentRecord[] = workspaces.flatMap(workspace => workspace.people
    .filter(person => person.role === "student" && classroomCode(person.cohort) === classroom)
    .map(person => ({ person, workspace })))
    .sort((a, b) => (a.person.studentNumber || "").localeCompare(b.person.studentNumber || "", "th"));

  function roomSlots(workspace: CourseWorkspace) {
    const matching = workspace.rooms.filter(room => room.phase === "before_midterm" && classroomCode(room.cohort) === classroom);
    const slots = Array.from({ length: 4 }, () => undefined as typeof matching[number] | undefined);
    matching.forEach(room => {
      const match = room.name.match(/([1-4])/);
      const preferred = match ? Number(match[1]) - 1 : -1;
      const index = preferred >= 0 && !slots[preferred] ? preferred : slots.findIndex(slot => !slot);
      if (index >= 0) slots[index] = room;
    });
    return slots;
  }

  const primaryWorkspace = workspaces[0];
  const primaryRooms = primaryWorkspace ? roomSlots(primaryWorkspace) : [];
  const grouped = Array.from({ length: 4 }, () => [] as StudentRecord[]);
  const unassigned: StudentRecord[] = [];
  students.forEach(student => {
    const slots = roomSlots(student.workspace);
    const membership = student.workspace.memberships.find(item => item.studentId === student.person.id && item.phase === "before_midterm");
    const assignedIndex = membership ? slots.findIndex(room => room?.id === membership.roomId) : -1;
    if (assignedIndex >= 0) grouped[assignedIndex].push(student); else unassigned.push(student);
  });

  return <>
    <section className="responsible-summary"><span>ห้องเรียน <strong>{classroom}</strong></span><span>นักศึกษาทั้งหมด <strong>{students.length}</strong></span><span>จำนวนกลุ่ม <strong>4</strong></span><span>อาจารย์ <strong>1 คน / กลุ่ม</strong></span></section>
    <section className="teacher-group-grid" aria-label={`การแบ่งกลุ่มห้อง ${classroom}`}>
      {grouped.map((groupStudents, groupIndex) => {
        const room = primaryRooms[groupIndex];
        const assignmentWorkspace = primaryWorkspace;
        const teachers = assignmentWorkspace?.people.filter(person => person.role === "instructor").map(person => ({ id: person.id, fullName: person.fullName })) || [];
        const availableStudents = unassigned.filter(student => student.workspace.course.id === assignmentWorkspace?.course.id).map(student => ({ id: student.person.id, label: `${student.person.studentNumber || "—"} · ${student.person.fullName}` }));
        return <article className="teacher-group-card" key={groupIndex}>
          <header><div><span>GROUP {String(groupIndex + 1).padStart(2, "0")}</span><h3>กลุ่มที่ {groupIndex + 1}</h3></div>{assignmentWorkspace ? <GroupInstructorSelect courseId={assignmentWorkspace.course.id} roomId={room?.id} classroom={classroom} groupNumber={groupIndex + 1} teachers={teachers} initialValue={room?.instructorId || ""} canManage={assignmentWorkspace.canManage} /> : <div className="group-teacher"><small>อาจารย์ผู้รับผิดชอบ</small><strong>ยังไม่มอบหมาย</strong></div>}</header>
          {assignmentWorkspace && <AddStudentToGroup students={availableStudents} courseId={assignmentWorkspace.course.id} classroom={classroom} groupNumber={groupIndex + 1} roomId={room?.id} canManage={assignmentWorkspace.canManage} />}
          <div className="course-table-wrap"><table><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ</th><th>สกุล</th><th>จัดกลุ่ม</th></tr></thead><tbody>
            {!groupStudents.length && <tr><td className="sheet-empty-cell" colSpan={5}>ยังไม่มีนักศึกษาในกลุ่มนี้</td></tr>}
            {groupStudents.map(({ person, workspace }, index) => { const name = splitName(person.fullName); const slots = roomSlots(workspace); return <tr key={person.id}><td>{index + 1}</td><td>{person.studentNumber || "—"}</td><td>{name.firstName}</td><td>{name.lastName || "—"}</td><td><StudentGroupSelect studentId={person.id} courseId={workspace.course.id} classroom={classroom} currentGroup={groupIndex + 1} roomIds={slots.map(item => item?.id)} canManage={workspace.canManage} /></td></tr>; })}
          </tbody></table></div>
        </article>;
      })}
    </section>
    {unassigned.length > 0 && <section className="unassigned-students"><div><p className="card-label">UNASSIGNED STUDENTS</p><h3>นักศึกษาที่ยังไม่จัดกลุ่ม</h3></div><div className="course-table-wrap"><table><thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ–นามสกุล</th><th>เลือกกลุ่ม</th></tr></thead><tbody>{unassigned.map(({ person, workspace }) => { const slots = roomSlots(workspace); return <tr key={person.id}><td>{person.studentNumber || "—"}</td><td>{person.fullName}</td><td><StudentGroupSelect studentId={person.id} courseId={workspace.course.id} classroom={classroom} currentGroup={0} roomIds={slots.map(item => item?.id)} canManage={workspace.canManage} /></td></tr>; })}</tbody></table></div></section>}
    <p className="course-hint">สามารถเพิ่ม ย้าย หรือนำนักศึกษาออกจากกลุ่ม รวมถึงเปลี่ยนหรือนำอาจารย์ผู้รับผิดชอบออกได้จากช่องเลือกในแต่ละกลุ่ม</p>
  </>;
}
