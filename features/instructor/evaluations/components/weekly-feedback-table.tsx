"use client";

import { useState, type FormEvent } from "react";

export type WeeklyStudent = {
  id: string;
  courseId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  groupName: string;
  feedback?: { week: number; comment: string; updatedAt: number };
};

export function WeeklyFeedbackTable({ students }: { students: WeeklyStudent[] }) {
  const [feedback, setFeedback] = useState<Record<string, WeeklyStudent["feedback"]>>(Object.fromEntries(students.map(student => [student.id, student.feedback])));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [week, setWeek] = useState(1);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const selected = students.find(student => student.id === selectedId);

  function open(student: WeeklyStudent) {
    const current = feedback[student.id];
    setSelectedId(student.id);
    setWeek(current?.week || 1);
    setComment(current?.comment || "");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/instructor/weekly-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: selected.courseId, studentId: selected.id, week, comment }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      setFeedback(current => ({ ...current, [selected.id]: { week, comment: comment.trim(), updatedAt: result.updatedAt } }));
      setSelectedId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <>
    <section className="weekly-student-table"><div className="weekly-table-heading"><div><p className="card-label">STUDENT LIST</p><h3>รายชื่อนักศึกษาซ้อมสอน</h3></div><span>{students.length} คน</span></div>
      <div className="course-table-wrap"><table><thead><tr><th>ลำดับที่</th><th>รหัสนักศึกษา</th><th>ชื่อ–นามสกุล</th><th>กลุ่ม</th><th>Feedback ล่าสุด</th><th></th></tr></thead><tbody>
        {!students.length && <tr><td className="sheet-empty-cell" colSpan={6}>ยังไม่มีนักศึกษาในห้องนี้</td></tr>}
        {students.map((student, index) => { const current = feedback[student.id]; return <tr key={`${student.courseId}-${student.id}`}><td>{index + 1}</td><td>{student.studentNumber || "—"}</td><td><button type="button" className="weekly-student-name" onClick={() => open(student)}>{student.firstName} {student.lastName}</button></td><td>{student.groupName}</td><td>{current ? <span className="feedback-status has-feedback">สัปดาห์ที่ {current.week} · บันทึกแล้ว</span> : <span className="feedback-status">ยังไม่มี Feedback</span>}</td><td><button type="button" className="weekly-feedback-action" onClick={() => open(student)}>{current ? "แก้ไขคอมเมนต์" : "ให้ Feedback"}</button></td></tr>; })}
      </tbody></table></div>
    </section>

    {selected && <div className="feedback-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pending) setSelectedId(null); }}><section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
      <header><div><p className="card-label">WEEKLY FEEDBACK</p><h3 id="feedback-dialog-title">Feedback สำหรับ {selected.firstName} {selected.lastName}</h3><span>{selected.studentNumber} · {selected.groupName}</span></div><button type="button" aria-label="ปิด" onClick={() => setSelectedId(null)} disabled={pending}>×</button></header>
      <form onSubmit={save}><label>สัปดาห์ที่<input type="number" min={1} max={20} value={week} onChange={event => setWeek(Number(event.target.value))} required /></label><label>Feedback หรือคอมเมนต์<textarea rows={8} maxLength={4000} value={comment} onChange={event => setComment(event.target.value)} placeholder="บันทึกสิ่งที่ทำได้ดี สิ่งที่ควรปรับปรุง หรือคำแนะนำสำหรับการซ้อมครั้งถัดไป" required /></label>{error && <p className="feedback-dialog-error" role="alert">{error}</p>}<div className="feedback-dialog-actions"><button type="button" onClick={() => setSelectedId(null)} disabled={pending}>ยกเลิก</button><button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก Feedback"}</button></div></form>
    </section></div>}
  </>;
}
