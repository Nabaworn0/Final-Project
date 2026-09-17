"use client";

import { useMemo, useState } from "react";

const weeklyItems = ["การเตรียมความพร้อม", "ความถูกต้องของเนื้อหา", "การอธิบาย", "การใช้คำถาม", "การบริหารเวลา", "การใช้สื่อ", "บุคลิกภาพ"];
const midtermGroups = [
  ["การวางแผนการสอน", ["วัตถุประสงค์ชัดเจน", "กิจกรรมสอดคล้องกับวัตถุประสงค์", "การวัดผลสอดคล้อง", "แผนการสอนครบถ้วน"]],
  ["เนื้อหา", ["ถูกต้องตามหลักวิชา", "ครบถ้วนตามสาระ", "ลำดับเนื้อหาเหมาะสม", "ใช้ภาษาถูกต้อง"]],
  ["เทคนิคการสอน", ["อธิบายชัดเจน", "ตั้งคำถามเหมาะสม", "กระตุ้นการมีส่วนร่วม", "ยกตัวอย่างเชื่อมโยง"]],
  ["การใช้สื่อ", ["สอดคล้องกับเนื้อหา", "อ่านและเข้าใจง่าย", "ใช้อุปกรณ์คล่องแคล่ว", "ส่งเสริมการเรียนรู้"]],
  ["บุคลิกภาพและชั้นเรียน", ["น้ำเสียงและความมั่นใจ", "บริหารชั้นเรียน", "สร้างบรรยากาศเชิงบวก", "ตรงเวลาและรับผิดชอบ"]],
] as const;

export function IndividualAssessmentForm({ mode }: { mode: "weekly" | "midterm" }) {
  const items = mode === "weekly" ? weeklyItems.map((item) => ({ group: "แบบประเมินการซ้อมสอน", item })) : midtermGroups.flatMap(([group, rows]) => rows.map((item) => ({ group, item })));
  const [scores, setScores] = useState<Record<string, number>>({});
  const total = useMemo(() => items.reduce((sum, row) => sum + (scores[`${row.group}:${row.item}`] ?? 0), 0), [items, scores]);
  const maxScore = items.length * 5;
  const groups = Array.from(new Set(items.map((row) => row.group)));

  return <div className="assessment-page-grid">
    <form className="system-card phase-assessment-form" onSubmit={(event) => event.preventDefault()}>
      <div className="assessment-intro"><div><p className="card-label">{mode === "weekly" ? "WEEKLY PRACTICE" : "MIDTERM INDIVIDUAL"}</p><h2>{mode === "weekly" ? "ประเมินการซ้อมสอนรายสัปดาห์" : "ประเมินการสอบสอนกลางภาค"}</h2><p>{mode === "weekly" ? "ให้คะแนนพร้อมติดตามเป้าหมายจากการซ้อมครั้งก่อน" : "ประเมินการสอนรายบุคคลตาม Rubric 5 ด้าน"}</p></div><div className="phase-total"><span>คะแนนรวม</span><strong>{total}</strong><small>/ {maxScore}</small></div></div>
      <div className="assessment-context-grid"><label>อีเมลนักศึกษา<input type="email" name="studentEmail" placeholder="student@email.kmutnb.ac.th" /></label><label>{mode === "weekly" ? "สัปดาห์ที่" : "วันที่สอบ"}<input type={mode === "weekly" ? "number" : "date"} name="period" min={mode === "weekly" ? 1 : undefined} /></label><label>หัวข้อการสอน<input name="topic" placeholder="ระบุหัวข้อที่นักศึกษาสอน" /></label></div>
      {mode === "weekly" && <section className="previous-target-panel"><div><p className="card-label">PREVIOUS TARGET</p><h3>เป้าหมายจากครั้งก่อน</h3></div><p>จะปรากฏเมื่อเลือกนักศึกษาที่มีประวัติการประเมิน</p><select aria-label="ผลของเป้าหมายครั้งก่อน" defaultValue="none"><option value="none">ยังไม่มีข้อมูลครั้งก่อน</option><option value="improved">ดีขึ้นแล้ว</option><option value="partial">ดีขึ้นเล็กน้อย</option><option value="needs-work">ยังต้องปรับปรุง</option></select></section>}
      <section className="phase-rubric"><div className="rubric-table-head"><strong>เกณฑ์การประเมิน</strong><span>คะแนน 0–5</span></div>{groups.map((group, groupIndex) => <fieldset key={group}><legend>{mode === "midterm" && <span>{groupIndex + 1}</span>}{group}</legend>{items.filter((row) => row.group === group).map((row) => { const key = `${row.group}:${row.item}`; return <div className="phase-score-row" key={key}><label htmlFor={key}>{row.item}</label><select id={key} value={scores[key] ?? 0} onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}>{[0, 1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select><span>/ 5</span></div>; })}</fieldset>)}</section>
      <section className="structured-feedback"><label>จุดเด่น<textarea rows={3} placeholder="สิ่งที่นักศึกษาทำได้ดี" /></label><label>จุดที่ควรปรับปรุง<textarea rows={3} placeholder="สิ่งที่ควรพัฒนา" /></label><label>ข้อเสนอแนะสำหรับครั้งถัดไป<textarea rows={3} placeholder="เป้าหมายที่ตรวจติดตามได้" /></label></section>
      <div className="evaluation-submit"><p>การบันทึกแบบร่างและส่ง Feedback จะเปิดหลังเชื่อมฐานข้อมูลการประเมิน</p><div><button type="button" disabled>บันทึกร่าง</button><button type="button" disabled>ส่ง Feedback</button></div></div>
    </form>
    <aside className="process-card phase-side-guide"><p className="card-label">ASSESSMENT STATUS</p><h3>สถานะการประเมิน</h3><div><span>01</span>Draft · แก้ไขคะแนนได้</div><div><span>02</span>Submitted · ส่งให้นักศึกษา</div><div><span>03</span>Locked · ปิดการแก้ไข</div><p className="phase-guide-note">ระบบจะไม่ส่งข้อความจาก AI โดยอัตโนมัติ อาจารย์ต้องตรวจสอบ แก้ไข และยืนยันก่อนทุกครั้ง</p></aside>
  </div>;
}
