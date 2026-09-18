import Link from "next/link";

const phases = [
  { code: "01", title: "Weekly Practice", thaiTitle: "ซ้อมสอนเดี่ยวและซ้อมคู่", description: "ก่อนกลางภาคซ้อมเดี่ยว หลังกลางภาคซ้อมคู่", score: "เฉพาะ Feedback · ไม่มีคะแนน" },
  { code: "02", title: "Midterm Individual", thaiTitle: "สอบสอนเดี่ยว", description: "ประเมินการสอนรายบุคคลโดยกรรมการที่ได้รับมอบหมาย", score: "เกณฑ์คะแนนรอยืนยันจากเอกสารรายวิชา" },
  { code: "03", title: "Final Pair", thaiTitle: "สอบสอนเป็นคู่", description: "ประเมินการทำงานเป็นคู่และการสอนรายบุคคล", score: "เกณฑ์คะแนนรอยืนยันจากเอกสารรายวิชา" },
] as const;

export function InstructorDashboard({ studentCount, courseCount }: { studentCount: number; courseCount: number }) {
  return <div className="teacher-dashboard">
    <section className="teacher-dashboard-heading">
      <div><p className="card-label">TEACHER DASHBOARD</p><h2>ภาพรวมการติดตามนักศึกษาฝึกสอน</h2><span>ดูงานที่ต้องประเมิน ติดตาม Feedback เดิม และตรวจพัฒนาการจากทุกช่วงการฝึกสอน</span></div>
      <Link className="solid-link" href="/instructor/courses">จัดการห้องเรียน ↗</Link>
    </section>

    <section className="teacher-summary" aria-label="สรุปข้อมูลสำคัญ">
      <article><span>ผู้เรียนในห้องที่รับผิดชอบ</span><strong>{studentCount}</strong><small>รายชื่อไม่ซ้ำจาก {courseCount} รายวิชาที่เข้าถึงได้</small></article>
      <article><span>ประเมินแล้ว</span><strong>—</strong><small>ยังไม่มีข้อมูลในรอบปัจจุบัน</small></article>
      <article><span>รอประเมิน</span><strong>—</strong><small>จะแสดงเมื่อกำหนดรอบประเมิน</small></article>
      <article className="current-phase-stat"><span>รอบปัจจุบัน</span><strong>ยังไม่กำหนด</strong><small>Weekly · Midterm · Final</small></article>
    </section>

    <section className="teacher-primary-grid">
      <article className="system-card current-assessment-card">
        <div className="section-heading"><div><p className="card-label">CURRENT ASSESSMENT</p><h3>รอบประเมินปัจจุบัน</h3></div><span className="neutral-status">ยังไม่ได้ตั้งค่า</span></div>
        <div className="current-assessment-empty"><span aria-hidden="true">◎</span><div><strong>ยังไม่มีรอบที่กำลังดำเนินการ</strong><p>เมื่อเชื่อมรายวิชา ห้อง และรายชื่อนักศึกษาแล้ว งานที่รอประเมินจะปรากฏตรงนี้</p></div></div>
        <Link href="/instructor/evaluations/weekly">เปิดแบบประเมิน →</Link>
      </article>
      <article className="system-card attention-overview">
        <p className="card-label">PENDING WORK</p><h3>งานที่รออาจารย์ตรวจ</h3>
        <div className="compact-empty"><span>○</span><p>ยังไม่มีแผนการสอน คลิป หรือ Transcript ที่รอตรวจ</p></div>
        <Link href="/instructor/evaluations">ดูรายการทั้งหมด →</Link>
      </article>
    </section>

    <section className="system-card phase-section">
      <div className="list-heading"><div><p className="card-label">ASSESSMENT PHASES</p><h2>การประเมิน 3 ช่วง</h2><p className="list-description">แต่ละช่วงใช้เกณฑ์ต่างกันตามวัตถุประสงค์ แต่ผลทั้งหมดเชื่อมเป็นพัฒนาการรายบุคคล</p></div><Link href="/instructor/evaluations">ดูการประเมินทั้งหมด →</Link></div>
      <div className="phase-grid">{phases.map((phase) => <article key={phase.code}><span>{phase.code}</span><div><small>{phase.title}</small><h3>{phase.thaiTitle}</h3><p>{phase.description}</p><b>{phase.score}</b></div></article>)}</div>
    </section>

    <section className="teacher-lower-grid">
      <article className="system-card student-monitor-card">
        <div className="section-heading"><div><p className="card-label">INSTRUCTOR ASSIGNMENT</p><h3>อาจารย์ผู้รับผิดชอบ</h3></div><Link href="/instructor/students">ดูรายชื่ออาจารย์ →</Link></div>
        <div className="compact-empty student-monitor-empty"><span>↗</span><p>สถานะ “ดีขึ้น–คงที่–ต้องติดตาม” และคะแนนครั้งล่าสุดจะแสดงหลังมีผลอย่างน้อยสองครั้ง</p></div>
      </article>
      <article className="system-card feedback-loop-card">
        <p className="card-label">FEEDBACK LOOP</p><h3>Feedback ที่ติดตามผลได้</h3><ol><li><b>01</b><span>บันทึกจุดเด่นและสิ่งที่ควรปรับ</span></li><li><b>02</b><span>ตั้งเป้าหมายสำหรับครั้งถัดไป</span></li><li><b>03</b><span>ระบุผลว่า ดีขึ้น หรือยังต้องปรับ</span></li></ol>
      </article>
    </section>
  </div>;
}
