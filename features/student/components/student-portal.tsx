"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export type StudentPageKind =
  | "student-dashboard"
  | "teaching"
  | "video-upload"
  | "performance"
  | "profile";

type PlanOption = { id: string; title: string };

const studentNav = [
  ["/student/lesson-plans", "แผนการสอน"],
  ["/student/teaching-sessions", "วิเคราะห์การฝึกสอน"],
  ["/student/performance", "คะแนน"],
  ["/student/profile", "โปรไฟล์"],
] as const;

const titles: Record<StudentPageKind, string> = {
  "student-dashboard": "พื้นที่เตรียมความพร้อมของนักศึกษา",
  teaching: "วิเคราะห์การฝึกสอน",
  "video-upload": "เพิ่มคลิปฝึกสอน",
  performance: "คะแนนและผลประเมิน",
  profile: "ข้อมูลนักศึกษา",
};

export function StudentPortal({ kind, lessonPlans = [] }: { kind: StudentPageKind; lessonPlans?: PlanOption[] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return <main className={`system-shell ${menuOpen ? "menu-open" : ""}`}>
    <aside className="system-sidebar">
      <Link className="wordmark system-brand" href="/student/dashboard">
        <Image className="brand-logo brand-logo-sidebar" src="/ced-logo-mark.png" width={64} height={64} alt="ตราภาควิชาคอมพิวเตอร์ศึกษา" />
        <span className="brand-copy-web"><strong>CED Assessment</strong><small>FTE · KMUTNB</small></span>
      </Link>
      <p className="role-chip">STUDENT PORTAL</p>
      <nav>{studentNav.map(([href, label], index) => <Link key={href} href={href} className={isActive(kind, href) ? "active" : ""}>
        <span>0{index + 1}</span>{label}
      </Link>)}</nav>
      <div className="system-user"><span>น</span><div><strong>บัญชีนักศึกษา</strong><small>นักศึกษาฝึกสอน</small></div></div>
    </aside>
    <section className="system-main">
      <header className="system-topbar">
        <button className="system-menu" type="button" aria-expanded={menuOpen} aria-label="เปิดเมนู" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <div><p>STUDENT WORKSPACE</p><h1>{titles[kind]}</h1></div>
        <Link href="/student/dashboard">พื้นที่นักศึกษา ↗</Link>
        <form className="logout-form" action="/api/auth/logout" method="post"><button type="submit">ออกจากระบบ</button></form>
      </header>
      <div className="system-content">
        {kind === "student-dashboard" && <StudentDashboardContent hasPlans={lessonPlans.length > 0} />}
        {kind === "teaching" && <TeachingSessions />}
        {kind === "video-upload" && <VideoUpload lessonPlans={lessonPlans} />}
        {kind === "performance" && <EmptyScores />}
        {kind === "profile" && <EmptyProfile />}
      </div>
    </section>
    {menuOpen && <button className="system-scrim" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />}
  </main>;
}

function isActive(kind: StudentPageKind, href: string) {
  if (kind === "student-dashboard") return href.includes("dashboard");
  if (kind === "teaching" || kind === "video-upload") return href.includes("teaching-sessions");
  return href.includes(kind);
}

function StudentDashboardContent({ hasPlans }: { hasPlans: boolean }) {
  return <>
    <section className="system-welcome student-welcome"><div><p>STUDENT PRACTICE WORKSPACE</p><h2>เตรียมการสอนอย่างเป็นขั้นตอน</h2><span>อัปโหลดแผนไว้เป็นเอกสารอ้างอิง แล้วเพิ่มคลิปฝึกสอนเพื่อเปรียบเทียบคำพูดกับแผน</span></div><Link href={hasPlans ? "/student/teaching-sessions/upload" : "/student/lesson-plans/upload"}>{hasPlans ? "เพิ่มคลิปฝึกสอน" : "อัปโหลดแผนการสอน"} →</Link></section>
    <section className="student-flow" aria-label="ขั้นตอนการวิเคราะห์การฝึกสอน">
      <article className="system-card"><span>01</span><div><p className="card-label">LESSON PLAN</p><h3>อัปโหลดแผนการสอน</h3><p>เก็บไฟล์ PDF หรือ DOCX ไว้เป็นเอกสารอ้างอิง โดยยังไม่มีการตรวจหรือให้คะแนนแผน</p><Link href="/student/lesson-plans/upload">ไปยังแผนการสอน →</Link></div></article>
      <article className="system-card"><span>02</span><div><p className="card-label">PRACTICE RECORDING</p><h3>เพิ่มคลิปฝึกสอน</h3><p>เลือกแผนที่อัปโหลดไว้ แล้วเพิ่มคลิปเสียงหรือวิดีโอจากการฝึกสอน</p><Link href="/student/teaching-sessions/upload">ไปยังการเพิ่มคลิป →</Link></div></article>
      <article className="system-card"><span>03</span><div><p className="card-label">ALIGNMENT REPORT</p><h3>ดูผลการเปรียบเทียบ</h3><p>ผลจะแสดงหลังระบบถอดเสียงและเปรียบเทียบคลิปกับแผนที่เลือกสำเร็จ</p></div></article>
    </section>
    <EmptyState title="ยังไม่มีผลการฝึกสอน" description="เมื่ออัปโหลดและประมวลผลคลิปสำเร็จ ผลล่าสุดจะปรากฏในพื้นที่นี้" href="/student/teaching-sessions/upload" action="เพิ่มคลิปฝึกสอน" />
  </>;
}

function TeachingSessions() {
  return <section className="system-card"><div className="list-heading"><div><p className="card-label">PLAN–PRACTICE ALIGNMENT</p><h2>คลิปฝึกสอนของฉัน</h2><p className="list-description">คลิปที่อัปโหลดและผลการเปรียบเทียบจะปรากฏที่นี่</p></div><Link className="solid-link" href="/student/teaching-sessions/upload">+ เพิ่มคลิปเสียงหรือวิดีโอ</Link></div><EmptyState embedded title="ยังไม่มีคลิปฝึกสอน" description="เริ่มจากอัปโหลดแผนการสอน จากนั้นจึงเลือกแผนและเพิ่มคลิปเพื่อเปรียบเทียบ" href="/student/lesson-plans/upload" action="อัปโหลดแผนการสอน" /></section>;
}

function VideoUpload({ lessonPlans }: { lessonPlans: PlanOption[] }) {
  if (lessonPlans.length === 0) return <EmptyState title="ต้องมีแผนการสอนก่อนเพิ่มคลิป" description="อัปโหลดแผนไว้เป็นเอกสารอ้างอิงก่อน แล้วจึงกลับมาเพิ่มคลิปเสียงหรือวิดีโอ" href="/student/lesson-plans/upload" action="อัปโหลดแผนการสอน" />;

  return <div className="form-layout"><form className="system-card form-card"><p className="card-label">PRACTICE RECORDING</p><h2>เพิ่มคลิปเพื่อเปรียบเทียบกับแผน</h2><p className="form-description">เลือกแผนและไฟล์การฝึกสอน ระบบจะเริ่มเปรียบเทียบเมื่อส่วนประมวลผลคลิปพร้อมใช้งาน</p><label>แผนการสอนที่ต้องการเปรียบเทียบ<select name="lessonPlan" required defaultValue=""><option value="" disabled>เลือกแผนการสอน</option>{lessonPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label><label>ชื่อการฝึก<input name="title" placeholder="เช่น ฝึกสอนครั้งที่ 1" required /></label><label className="upload-box video-box"><b>＋</b><strong>เลือกคลิปเสียงหรือวิดีโอ</strong><small>MP3, M4A, WAV, MP4 หรือ MOV</small><input className="practice-file-input" name="recording" type="file" accept="audio/*,video/mp4,video/quicktime" required /></label><button className="analyze-button" type="button" disabled aria-disabled="true">ระบบอัปโหลดคลิปยังไม่เปิดใช้งาน</button></form><aside className="process-card"><p className="card-label">กระบวนการหลังเปิดใช้งาน</p><h3>เปรียบเทียบคำพูดกับแผนที่เลือก</h3>{["รับคลิปเสียงหรือวิดีโอ", "ถอดเสียงพร้อมช่วงเวลา", "อ่านข้อความจากแผนที่เลือก", "เปรียบเทียบคำพูดกับแผน", "บันทึกผลเพื่อดูพัฒนาการ"].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}</aside></div>;
}

function EmptyScores() {
  return <EmptyState title="ยังไม่มีคะแนนและผลประเมิน" description="คะแนนเฉลี่ยและ Feedback จากอาจารย์จะปรากฏในหน้านี้เมื่อมีการส่งผลประเมินแล้ว" href="/student/teaching-sessions" action="ไปยังการฝึกสอน" />;
}

function EmptyProfile() {
  return <section className="system-card empty-workspace"><p className="card-label">STUDENT PROFILE</p><h2>ข้อมูลนักศึกษา</h2><p>ข้อมูลส่วนบุคคลและข้อมูลรายวิชายังไม่ได้เชื่อมต่อในระยะนี้</p></section>;
}

function EmptyState({ title, description, href, action, embedded = false }: { title: string; description: string; href: string; action: string; embedded?: boolean }) {
  return <section className={embedded ? "empty-workspace empty-workspace-embedded" : "system-card empty-workspace"}><span aria-hidden="true">○</span><h2>{title}</h2><p>{description}</p><Link className="solid-link" href={href}>{action} →</Link></section>;
}
