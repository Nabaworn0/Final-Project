"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { parseStudentWorkbook, type ImportedSheet } from "./excel-import";
import type { Course, CoursePerson, CourseRoom, CourseWorkspace } from "./types";

type Editor = "course" | "person" | "room" | "import" | null;
type StudentCellValues = { firstName: string; lastName: string; studentNumber: string; email: string };

function splitStudentName(fullName: string) {
  const [firstName = "", ...surnameParts] = fullName.trim().split(/\s+/);
  return { firstName, lastName: surnameParts.join(" ") };
}

function classroomCode(value: string | null) {
  const normalized = value?.trim().toUpperCase() || "";
  if (normalized.includes("CED")) return "CED";
  if (normalized.includes("TCT")) return "TCT";
  return "";
}

export function CourseManager({ courses, workspace: w, canCreate, error }: {
  courses: Course[]; workspace: CourseWorkspace | null; canCreate: boolean; error: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState({ text: "", error: false });
  const [person, setPerson] = useState<CoursePerson | null>(null);
  const [room, setRoom] = useState<CourseRoom | null>(null);
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [editor, setEditor] = useState<Editor>(!courses.length && canCreate ? "course" : null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [importSheets, setImportSheets] = useState<ImportedSheet[]>([]);
  const [importSheetIndex, setImportSheetIndex] = useState(0);
  const [importFileName, setImportFileName] = useState("");
  const allStudents = w?.people.filter(p => p.role === "student") || [];
  const classrooms = ["CED", "TCT"] as const;
  const [selectedCohort, setSelectedCohort] = useState("");
  const activeCohort = classrooms.includes(selectedCohort as typeof classrooms[number]) ? selectedCohort : "";
  const students = activeCohort ? allStudents.filter(p => classroomCode(p.cohort) === activeCohort) : [];
  const teachers = w?.people.filter(p => p.role === "instructor") || [];
  const allRooms = w?.rooms.filter(r => r.phase === "before_midterm") || [];
  const rooms = activeCohort ? allRooms.filter(r => !r.cohort || r.cohort.trim().toUpperCase() === activeCohort) : [];
  const memberships = w?.memberships.filter(m => m.phase === "before_midterm" && students.some(student => student.id === m.studentId)) || [];
  const unassigned = students.filter(p => !memberships.some(m => m.studentId === p.id));

  function openPerson(selected?: CoursePerson, selectedRole: "student" | "instructor" = "student") {
    setPerson(selected || null);
    setRole(selected?.role || selectedRole);
    setEditor("person");
  }
  function openRoom(selected?: CourseRoom) {
    setRoom(selected || null);
    setEditor("room");
  }
  async function mutate(data: Record<string, unknown>, action: string, form?: HTMLFormElement): Promise<boolean> {
    if (pending) return false;
    setPending(true);
    setNotice({ text: "กำลังบันทึก…", error: false });
    try {
      const response = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, action, courseId: w?.course.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setNotice({ text: action === "import_students" ? `นำเข้า ${result.importedCount} คนแล้ว · เพิ่มใหม่ ${result.createdCount} · อัปเดต ${result.updatedCount}` : "บันทึกข้อมูลเรียบร้อยแล้ว", error: false });
      if (action === "save_person" || action === "save_room") {
        setPerson(null); setRoom(null); setEditor(null); form?.reset();
      }
      if (action === "create_course") {
        setEditor(null);
        router.push(`/instructor/courses?course=${result.courseId}`);
      }
      if (action === "import_students") { setEditor(null); setImportSheets([]); setImportFileName(""); }
      router.refresh();
      return true;
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง", error: true });
      return false;
    } finally {
      setPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    const form = event.currentTarget;
    await mutate(Object.fromEntries(new FormData(form)), action, form);
  }
  async function selectExcel(file: File | undefined) {
    if (!file) return;
    setNotice({ text: "กำลังอ่านไฟล์ Excel…", error: false });
    try {
      const sheets = await parseStudentWorkbook(file);
      const total = sheets.reduce((sum, item) => sum + item.rows.length, 0);
      setImportSheets(sheets); setImportSheetIndex(0); setImportFileName(file.name); setEditor("import");
      setNotice({ text: `อ่านไฟล์สำเร็จ ${sheets.length} แท็บ · ${total} คน กรุณาตรวจสอบก่อนนำเข้า`, error: false });
    } catch (e) {
      setImportSheets([]); setImportFileName("");
      setNotice({ text: e instanceof Error ? e.message : "อ่านไฟล์ Excel ไม่สำเร็จ", error: true });
    }
  }

  const selected = students.find(student => student.id === selectedStudent);

  return <div className="course-workspace course-sheet-workspace">
    <header className="course-sheet-heading">
      <div>
        <p className="card-label">CLASSROOM WORKSPACE</p>
        <h2>{activeCohort ? `ห้องเรียน ${activeCohort}` : "เลือกห้องเรียน"}</h2>
        <p>{activeCohort ? `รายชื่อนักศึกษาห้อง ${activeCohort}` : "เลือก CED หรือ TCT เพื่อดูและจัดการรายชื่อนักศึกษา"}</p>
      </div>
      <div className="course-sheet-actions">
        {w?.canManage && <><input id="course-excel-file" className="course-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => { void selectExcel(e.target.files?.[0]); e.currentTarget.value = ""; }} /><button type="button" className="secondary" onClick={() => document.getElementById("course-excel-file")?.click()}>นำเข้า Excel</button></>}
        {w?.canManage && activeCohort && <button type="button" onClick={() => openPerson(undefined, "student")}>+ เพิ่มนักศึกษา</button>}
      </div>
    </header>
    <div aria-live="polite" role="status" className={notice.error || error ? "course-message is-error" : "course-message"}>{notice.text || error}</div>

    {editor && <section className="course-sheet-editor" aria-label="แผงแก้ไขข้อมูล">
      <div className="course-editor-heading">
        <div><p className="card-label">QUICK EDIT</p><h3>{editor === "course" ? "สร้างรายวิชา" : editor === "import" ? "ตรวจสอบรายชื่อจาก Excel" : editor === "room" ? room ? "แก้ไขห้องเรียน" : "เพิ่มห้องเรียน" : person ? "แก้ไขรายชื่อ" : role === "student" ? "เพิ่มนักศึกษา" : "เพิ่มอาจารย์"}</h3></div>
        <button type="button" className="course-editor-close" aria-label="ปิดแผงแก้ไข" onClick={() => { setEditor(null); setPerson(null); setRoom(null); }}>×</button>
      </div>
      {editor === "course" && <form onSubmit={e => submit(e, "create_course")}><fieldset disabled={pending} className="course-fields">
        <label>รหัสวิชา<input name="code" required maxLength={30} placeholder="เช่น 020XXXXX" /></label>
        <label className="course-wide">ชื่อรายวิชา<input name="name" required maxLength={160} placeholder="ระบุชื่อรายวิชา" /></label>
        <label>ปีการศึกษา (พ.ศ.)<input name="academicYear" type="number" required min={2500} max={2700} defaultValue={new Date().getFullYear() + 543} /></label>
        <label>ภาคเรียน<select name="semester"><option value="1">ภาคเรียนที่ 1</option><option value="2">ภาคเรียนที่ 2</option><option value="summer">ฤดูร้อน</option></select></label>
        <div className="course-actions"><button type="submit">สร้างรายวิชา</button><button type="button" className="secondary" onClick={() => setEditor(null)}>ยกเลิก</button></div>
      </fieldset></form>}
      {editor === "person" && <form key={person?.id || `new-${role}`} onSubmit={e => submit(e, "save_person")}><fieldset disabled={pending} className="course-fields">
        {person && <input name="id" type="hidden" value={person.id} />}
        <label>บทบาท<select name="role" value={person?.role || role} onChange={e => { if (!person) setRole(e.target.value as typeof role); }}>{person ? <option value={person.role}>{person.role === "student" ? "นักศึกษา" : "อาจารย์"}</option> : <><option value="student">นักศึกษา</option><option value="instructor">อาจารย์</option></>}</select></label>
        <label>ชื่อ–นามสกุล<input name="fullName" required maxLength={160} defaultValue={person?.fullName} /></label>
        {(person?.role || role) === "student" && <><input name="cohort" type="hidden" value={person?.cohort || activeCohort} /><label>รหัสนักศึกษา<input name="studentNumber" required maxLength={30} defaultValue={person?.studentNumber || ""} /></label></>}
        <label className={(person?.role || role) === "instructor" ? "course-wide" : ""}>อีเมลมหาวิทยาลัย<input name="email" type="email" required maxLength={254} placeholder="name@email.kmutnb.ac.th" defaultValue={person?.email} /></label>
        <div className="course-actions"><button type="submit">{person ? "บันทึกการแก้ไข" : "เพิ่มรายชื่อ"}</button><button type="button" className="secondary" onClick={() => { setEditor(null); setPerson(null); }}>ยกเลิก</button></div>
      </fieldset></form>}
      {editor === "room" && <form key={room?.id || "new"} onSubmit={e => submit(e, "save_room")}><fieldset disabled={pending} className="course-fields">
        {room && <input name="id" type="hidden" value={room.id} />}
        <input name="cohort" type="hidden" value={room?.cohort || activeCohort} />
        <label>ชื่อห้อง<input name="name" required maxLength={80} placeholder="เช่น ห้อง 1" defaultValue={room?.name} /></label>
        <label>อาจารย์ผู้ดูแล 1 คน<select name="instructorId" defaultValue={room?.instructorId || ""}><option value="">ยังไม่มอบหมาย</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select></label>
        <div className="course-actions"><button type="submit">{room ? "บันทึกห้อง" : "สร้างห้อง"}</button><button type="button" className="secondary" onClick={() => { setEditor(null); setRoom(null); }}>ยกเลิก</button></div>
      </fieldset></form>}
      {editor === "import" && <ImportPreview fileName={importFileName} sheets={importSheets} selectedIndex={importSheetIndex} pending={pending} onSelect={setImportSheetIndex} onConfirm={() => void mutate({ rows: importSheets.flatMap(item => item.rows.map(row => ({ ...row, cohort: item.name }))) }, "import_students")} onCancel={() => { setEditor(null); setImportSheets([]); }} />}
    </section>}

    {!w && !error && !editor && <section className="course-panel course-empty"><h3>ยังไม่มีรายวิชาที่เข้าถึงได้</h3><p>{canCreate ? "กด “รายวิชาใหม่” เพื่อเริ่มต้น" : "กรุณาให้ผู้รับผิดชอบรายวิชาเพิ่มอีเมลและมอบหมายห้องเรียน"}</p></section>}

    {w && !activeCohort && <section className="classroom-picker" aria-labelledby="classroom-picker-title">
      <div className="classroom-picker-heading"><p className="card-label">SELECT CLASSROOM</p><h3 id="classroom-picker-title">เลือกห้องเรียน</h3><p>เลือกห้องที่ต้องการเพื่อเปิดดูและแก้ไขรายชื่อนักศึกษา</p></div>
      <div className="classroom-picker-grid">{classrooms.map(classroom => {
        const count = allStudents.filter(student => classroomCode(student.cohort) === classroom).length;
        return <button key={classroom} type="button" onClick={() => { setSelectedCohort(classroom); setSelectedStudent(null); }}><span>{classroom}</span><small>นักศึกษา {count} คน</small><b>เปิดห้องเรียน →</b></button>;
      })}</div>
    </section>}

    {w && activeCohort && <>
      <section className="classroom-toolbar"><button type="button" className="secondary" onClick={() => { setSelectedCohort(""); setSelectedStudent(null); }}>← เลือกห้องอื่น</button><div><strong>ห้องเรียน {activeCohort}</strong><span>นักศึกษา {students.length} คน</span></div></section>
      <section className="course-spreadsheet">
        <div className="course-formula-bar" aria-label="ข้อมูลแถวที่เลือก"><span>{selected ? `A${students.indexOf(selected) + 2}` : "—"}</span><b>ƒx</b><p>{selected?.fullName || "เลือกแถวนักศึกษาเพื่อดูข้อมูล"}</p></div>
        <StudentSheet students={students} canManage={w.canManage} pending={pending} selectedStudent={selectedStudent} onSelect={setSelectedStudent} onSave={(student, values) => mutate({ id: student.id, role: "student", fullName: `${values.firstName} ${values.lastName}`.trim(), studentNumber: values.studentNumber, email: values.email, cohort: activeCohort }, "save_person")} />
      </section>
      <p className="course-hint">แก้ไขรหัส ชื่อ และสกุลได้ภายในตาราง · ระบบบันทึกข้อมูลเมื่อออกจากช่องหรือกด Enter</p>
    </>}
  </div>;
}

function ImportPreview({ fileName, sheets, selectedIndex, pending, onSelect, onConfirm, onCancel }: {
  fileName: string; sheets: ImportedSheet[]; selectedIndex: number; pending: boolean; onSelect: (index: number) => void; onConfirm: () => void; onCancel: () => void;
}) {
  const selected = sheets[selectedIndex];
  const total = sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  return <div className="course-import-preview">
    <p><strong>{fileName}</strong> · {sheets.length} แท็บ · {total} คน</p>
    <nav className="course-import-tabs" aria-label="เลือกแท็บตัวอย่าง Excel">{sheets.map((sheet, index) => <button key={sheet.name} type="button" aria-current={index === selectedIndex ? "page" : undefined} onClick={() => onSelect(index)}>{sheet.name}<span>{sheet.rows.length}</span></button>)}</nav>
    {selected && <div className="course-table-wrap"><table><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ</th><th>สกุล</th></tr></thead><tbody>{selected.rows.slice(0, 10).map(row => <tr key={row.studentNumber}><td>{row.sequence}</td><td>{row.studentNumber}</td><td>{row.firstName}</td><td>{row.lastName}</td></tr>)}</tbody></table></div>}
    {selected && selected.rows.length > 10 && <p className="course-hint">แสดงตัวอย่าง 10 คนแรก จาก {selected.rows.length} คนในแท็บนี้</p>}
    <p className="course-hint">ระบบจะสร้างแท็บล่างตามชีตรายชื่อ และอัปเดตข้อมูลเดิมเมื่อพบรหัสนักศึกษาตรงกัน</p>
    <div className="course-actions"><button type="button" disabled={pending || !total} onClick={onConfirm}>ยืนยันนำเข้า {total} คน</button><button type="button" className="secondary" onClick={onCancel}>ยกเลิก</button></div>
  </div>;
}

function StudentSheet({ students, canManage, pending, selectedStudent, onSelect, onSave }: {
  students: CoursePerson[]; canManage: boolean; pending: boolean; selectedStudent: string | null; onSelect: (id: string) => void; onSave: (student: CoursePerson, values: StudentCellValues) => Promise<boolean>;
}) {
  return <div className="course-table-wrap"><table className="course-sheet-table"><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ</th><th>สกุล</th></tr></thead><tbody>
    {!students.length && <tr><td colSpan={4} className="sheet-empty-cell">ยังไม่มีนักศึกษาในห้องนี้ — นำเข้า Excel หรือกด “เพิ่มนักศึกษา” เพื่อเริ่มต้น</td></tr>}
    {students.map((student, index) => <EditableStudentRow key={student.id} student={student} index={index} canManage={canManage} pending={pending} selected={selectedStudent === student.id} onSelect={onSelect} onSave={onSave} />)}
  </tbody></table></div>;
}

function EditableStudentRow({ student, index, canManage, pending, selected, onSelect, onSave }: {
  student: CoursePerson; index: number; canManage: boolean; pending: boolean; selected: boolean; onSelect: (id: string) => void; onSave: (student: CoursePerson, values: StudentCellValues) => Promise<boolean>;
}) {
  const names = splitStudentName(student.fullName);
  const initial = { ...names, studentNumber: student.studentNumber || "", email: student.email };
  const [values, setValues] = useState<StudentCellValues>(initial);
  const [saved, setSaved] = useState<StudentCellValues>(initial);
  const dirty = values.firstName !== saved.firstName || values.lastName !== saved.lastName || values.studentNumber !== saved.studentNumber;
  async function save() {
    if (!dirty || pending) return;
    if (!values.firstName.trim() || !values.lastName.trim() || !values.studentNumber.trim()) return;
    const normalized = { firstName: values.firstName.trim(), lastName: values.lastName.trim(), studentNumber: values.studentNumber.trim(), email: values.email };
    if (await onSave(student, normalized)) { setValues(normalized); setSaved(normalized); }
  }
  const keySave = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void save(); } };
  return <tr className={selected ? "is-selected" : ""} onClick={() => onSelect(student.id)}>
    <td>{index + 1}</td>
    <td>{canManage ? <input className="sheet-cell-input" aria-label={`รหัสนักศึกษาของ ${student.fullName}`} value={values.studentNumber} onChange={e => setValues({ ...values, studentNumber: e.target.value })} onBlur={() => void save()} onKeyDown={keySave} /> : student.studentNumber}</td>
    <td>{canManage ? <input className="sheet-cell-input" aria-label={`ชื่อของ ${student.fullName}`} value={values.firstName} onChange={e => setValues({ ...values, firstName: e.target.value })} onBlur={() => void save()} onKeyDown={keySave} /> : names.firstName}</td>
    <td>{canManage ? <input className="sheet-cell-input" aria-label={`สกุลของ ${student.fullName}`} value={values.lastName} onChange={e => setValues({ ...values, lastName: e.target.value })} onBlur={() => void save()} onKeyDown={keySave} /> : names.lastName}</td>
  </tr>;
}

function GroupAssignmentSheet({ students, rooms, memberships, canManage, pending, onAssign }: {
  students: CoursePerson[]; rooms: CourseRoom[]; memberships: CourseWorkspace["memberships"]; canManage: boolean; pending: boolean; onAssign: (studentId: string, roomId: string) => void;
}) {
  return <section className="course-group-section"><h3>จัดนักศึกษาเข้ากลุ่ม</h3><div className="course-table-wrap"><table className="course-sheet-table"><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ–สกุล</th><th>กลุ่ม / ห้องเรียน</th></tr></thead><tbody>
    {!students.length && <tr><td colSpan={4} className="sheet-empty-cell">ยังไม่มีนักศึกษาในแท็บนี้</td></tr>}
    {students.map((student, index) => { const current = memberships.find(item => item.studentId === student.id)?.roomId || ""; return <tr key={student.id}><td>{index + 1}</td><td>{student.studentNumber}</td><td>{student.fullName}</td><td>{canManage ? <select className="sheet-cell-select" value={current} disabled={pending} aria-label={`กลุ่มของ ${student.fullName}`} onChange={event => onAssign(student.id, event.target.value)}><option value="">ยังไม่จัดกลุ่ม</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select> : rooms.find(room => room.id === current)?.name || "—"}</td></tr>; })}
  </tbody></table></div></section>;
}

function RoomSheet({ rooms, teachers, memberships, canManage, pending, onEdit, onAssign }: {
  rooms: CourseRoom[]; teachers: CoursePerson[]; memberships: CourseWorkspace["memberships"]; canManage: boolean; pending: boolean; onEdit: (room: CourseRoom) => void; onAssign: (room: CourseRoom, instructorId: string) => void;
}) {
  return <div className="course-table-wrap"><table className="course-sheet-table"><thead><tr><th className="row-number"></th><th>A · ห้องเรียน</th><th>B · อาจารย์ผู้ดูแล</th><th>C · จำนวนนักศึกษา</th><th>D · สถานะ</th></tr></thead><tbody>
    {!rooms.length && <tr><td className="row-number">1</td><td colSpan={4} className="sheet-empty-cell">ยังไม่มีห้องเรียน — กด “ห้องเรียน” เพื่อเพิ่ม</td></tr>}
    {rooms.map((r, index) => <tr key={r.id}><td className="row-number">{index + 2}</td><td><button type="button" className="sheet-cell-button" onClick={() => onEdit(r)}>{r.name}</button></td><td>{canManage ? <select className="sheet-cell-select" aria-label={`ผู้ดูแล ${r.name}`} value={r.instructorId || ""} disabled={pending} onChange={e => onAssign(r, e.target.value)}><option value="">ยังไม่มอบหมาย</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}</select> : teachers.find(t => t.id === r.instructorId)?.fullName || "—"}</td><td>{memberships.filter(m => m.roomId === r.id).length} คน</td><td><span className={r.instructorId ? "sheet-status is-ready" : "sheet-status"}>{r.instructorId ? "พร้อมใช้งาน" : "รอผู้ดูแล"}</span></td></tr>)}
  </tbody></table></div>;
}

function TeacherSheet({ teachers, rooms, canManage, onEdit }: { teachers: CoursePerson[]; rooms: CourseRoom[]; canManage: boolean; onEdit: (person: CoursePerson) => void }) {
  return <div className="course-table-wrap"><table className="course-sheet-table"><thead><tr><th className="row-number"></th><th>A · ชื่อ–นามสกุล</th><th>B · อีเมล</th><th>C · ห้องที่ดูแล</th><th>D · สถานะ</th></tr></thead><tbody>
    {!teachers.length && <tr><td className="row-number">1</td><td colSpan={4} className="sheet-empty-cell">ยังไม่มีอาจารย์ในรายวิชา</td></tr>}
    {teachers.map((t, index) => { const assignedRooms = rooms.filter(r => r.instructorId === t.id); return <tr key={t.id}><td className="row-number">{index + 2}</td><td>{canManage ? <button type="button" className="sheet-cell-button" onClick={() => onEdit(t)}>{t.fullName}</button> : t.fullName}</td><td>{t.email}</td><td>{assignedRooms.map(r => r.name).join(", ") || "—"}</td><td><span className={assignedRooms.length ? "sheet-status is-ready" : "sheet-status"}>{assignedRooms.length ? "ได้รับมอบหมาย" : "ยังไม่มีห้อง"}</span></td></tr>; })}
  </tbody></table></div>;
}
