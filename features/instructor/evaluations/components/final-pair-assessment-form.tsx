"use client";

import { useMemo, useState } from "react";

const groupCriteria = ["ความต่อเนื่องของบทเรียน", "การแบ่งหน้าที่", "การส่งต่อระหว่างผู้สอน", "ความสอดคล้องของสื่อ", "การบริหารเวลาร่วมกัน"];
const individualCriteria = [["ความรู้ในเนื้อหา", 15], ["เทคนิคการอธิบาย", 15], ["การตั้งคำถาม", 14], ["ปฏิสัมพันธ์กับผู้เรียน", 13], ["การแก้สถานการณ์", 13]] as const;

export function FinalPairAssessmentForm() {
  const [groupScores, setGroupScores] = useState<Record<string, number>>({});
  const [studentA, setStudentA] = useState<Record<string, number>>({});
  const [studentB, setStudentB] = useState<Record<string, number>>({});
  const groupTotal = useMemo(() => groupCriteria.reduce((sum, key) => sum + (groupScores[key] ?? 0), 0), [groupScores]);
  const totalA = useMemo(() => individualCriteria.reduce((sum, [key]) => sum + (studentA[key] ?? 0), 0), [studentA]);
  const totalB = useMemo(() => individualCriteria.reduce((sum, [key]) => sum + (studentB[key] ?? 0), 0), [studentB]);

  return <form className="final-assessment" onSubmit={(event) => event.preventDefault()}>
    <section className="system-card final-context"><div><p className="card-label">FINAL PAIR</p><h2>ประเมินการสอบสอนเป็นคู่</h2><p>คะแนนการทำงานร่วมกัน 30 คะแนน และคะแนนรายบุคคล 70 คะแนน</p></div><div className="final-context-fields"><label>อีเมลนักศึกษาคนที่ 1<input type="email" placeholder="student1@email.kmutnb.ac.th" /></label><label>อีเมลนักศึกษาคนที่ 2<input type="email" placeholder="student2@email.kmutnb.ac.th" /></label><label>หัวข้อการสอน<input placeholder="ระบุหัวข้อ" /></label><label>วันที่สอบ<input type="date" /></label></div></section>
    <section className="system-card final-group-score"><div className="section-heading"><div><p className="card-label">TEAM SCORE · 30</p><h3>คะแนนภาพรวมของคู่</h3></div><strong>{groupTotal} / 30</strong></div><div className="final-score-table">{groupCriteria.map((criterion) => <label key={criterion}><span>{criterion}</span><input type="number" min="0" max="6" value={groupScores[criterion] ?? 0} onChange={(event) => setGroupScores((current) => ({ ...current, [criterion]: Math.min(6, Math.max(0, Number(event.target.value))) }))} /><small>/ 6</small></label>)}</div></section>
    <section className="system-card final-individual-section"><div className="list-heading"><div><p className="card-label">INDIVIDUAL SCORE · 70</p><h2>คะแนนรายบุคคล</h2></div></div><div className="individual-score-grid"><IndividualScoreCard title="นักศึกษาคนที่ 1" scores={studentA} setScores={setStudentA} individualTotal={totalA} groupTotal={groupTotal} /><IndividualScoreCard title="นักศึกษาคนที่ 2" scores={studentB} setScores={setStudentB} individualTotal={totalB} groupTotal={groupTotal} /></div></section>
    <section className="system-card final-feedback"><p className="card-label">SHARED FEEDBACK</p><h3>ข้อเสนอแนะร่วม</h3><textarea rows={5} placeholder="ความต่อเนื่อง การแบ่งหน้าที่ การส่งต่อ และสิ่งที่ควรพัฒนาร่วมกัน" /><div className="evaluation-submit"><p>การบันทึกผลจะเปิดหลังเชื่อมฐานข้อมูลการประเมิน</p><div><button type="button" disabled>บันทึกร่าง</button><button type="button" disabled>ส่งผลประเมิน</button></div></div></section>
  </form>;
}

function IndividualScoreCard({ title, scores, setScores, individualTotal, groupTotal }: { title: string; scores: Record<string, number>; setScores: (value: Record<string, number>) => void; individualTotal: number; groupTotal: number }) {
  return <article><div className="individual-card-heading"><div><span>ผู้สอน</span><h3>{title}</h3></div><strong>{individualTotal + groupTotal}<small>/ 100</small></strong></div>{individualCriteria.map(([criterion, max]) => <label key={criterion}><span>{criterion}</span><input type="number" min="0" max={max} value={scores[criterion] ?? 0} onChange={(event) => setScores({ ...scores, [criterion]: Math.min(max, Math.max(0, Number(event.target.value))) })} /><small>/ {max}</small></label>)}<div className="individual-subtotal"><span>คะแนนรายบุคคล</span><strong>{individualTotal} / 70</strong></div></article>;
}
