import Link from "next/link";
import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { requireRole } from "@/lib/server/auth";
import { courseStore } from "@/lib/server/courses";
import "@/features/instructor/courses/courses.css";

export default async function Page() {
  const user = await requireRole("instructor");
  const store = courseStore();
  const courses = await store.listCourses(user);
  const workspaces = await Promise.all(courses.map(c => store.workspace(user, c.id)));
  return <InstructorShell title="นักศึกษาที่รับผิดชอบ" userName={user.fullName} active="students"><div className="course-workspace">
    <section className="course-current"><div><p className="card-label">MY STUDENTS</p><h2>นักศึกษาในความดูแล</h2><p>แสดงรายชื่อจริงตามห้องที่คุณมีสิทธิ์เข้าถึง</p></div><Link className="solid-link" href="/instructor/courses">ห้องเรียน ↗</Link></section>
    {!workspaces.length && <section className="course-panel"><h3>ยังไม่มีรายวิชาที่ได้รับมอบหมาย</h3><p>เริ่มจากจัดรายวิชา รายชื่อ และอาจารย์ประจำห้องก่อนครับ</p></section>}
    {workspaces.map(w => {
      const students = w.people.filter(p => p.role === "student");
      return <section className="course-panel" key={w.course.id}><div className="course-section-title"><h3>{w.course.code} · {w.course.name}</h3><Link href={`/instructor/courses?course=${w.course.id}`}>ดูห้องเรียน →</Link></div><p className="course-hint">ภาคเรียน {w.course.semester === "summer" ? "ฤดูร้อน" : w.course.semester}/{w.course.academicYear} · ก่อนสอบกลางภาค</p>
        {!students.length ? <p className="course-empty">ยังไม่มีรายชื่อนักศึกษา</p> : <div className="course-table-wrap"><table><thead><tr><th>ชื่อ–นามสกุล</th><th>รหัสนักศึกษา</th><th>ห้องเรียน</th><th>อาจารย์ผู้ดูแล</th></tr></thead><tbody>{students.map(p => {
          const membership = w.memberships.find(m => m.studentId === p.id && m.phase === "before_midterm");
          const room = w.rooms.find(r => r.id === membership?.roomId);
          const teacher = w.people.find(t => t.id === room?.instructorId);
          return <tr key={p.id}><td>{p.fullName}<small>{p.email}</small></td><td>{p.studentNumber}</td><td>{room?.name || "ยังไม่จัดห้อง"}</td><td>{teacher?.fullName || "ยังไม่มอบหมาย"}</td></tr>;
        })}</tbody></table></div>}
      </section>;
    })}
  </div></InstructorShell>;
}
