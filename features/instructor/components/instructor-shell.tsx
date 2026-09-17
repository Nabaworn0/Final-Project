"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const navigation = [
  ["/instructor/courses", "ห้องเรียน"],
  ["/instructor/students", "นักศึกษาที่รับผิดชอบ"],
  ["/instructor/evaluations/weekly", "ซ้อมสอนรายสัปดาห์"],
  ["/instructor/evaluations/midterm", "สอบกลางภาค"],
  ["/instructor/evaluations/final", "สอบปลายภาค"],
  ["/instructor/evidence", "หลักฐานการสอน"],
  ["/instructor/progress", "พัฒนาการและ Feedback"],
] as const;

export type InstructorNavigation = "courses" | "students" | "weekly" | "midterm" | "final" | "evidence" | "progress";

export function InstructorShell({ title, userName, active, children }: {
  title: string;
  userName: string;
  active: InstructorNavigation;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <main className={`system-shell instructor-shell ${menuOpen ? "menu-open" : ""}`}>
    <aside className="system-sidebar">
      <Link className="wordmark system-brand" href="/instructor/students">
        <Image className="brand-logo brand-logo-sidebar" src="/ced-logo-mark.png" width={64} height={64} alt="ตราภาควิชาคอมพิวเตอร์ศึกษา" />
        <span className="brand-copy-web"><strong>CED Assessment</strong><small>FTE · KMUTNB</small></span>
      </Link>
      <p className="role-chip">INSTRUCTOR PORTAL</p>
      <nav>{navigation.map(([href, label], index) => {
        const selected = href.endsWith(active);
        return <Link key={href} href={href} className={selected ? "active" : ""}><span>0{index + 1}</span>{label}</Link>;
      })}</nav>
      <div className="system-user"><span>{userName.trim().charAt(0) || "อ"}</span><div><strong>{userName}</strong><small>อาจารย์ผู้ประเมิน</small></div></div>
    </aside>
    <section className="system-main">
      <header className="system-topbar">
        <button className="system-menu" type="button" aria-expanded={menuOpen} aria-label="เปิดเมนู" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <div><p>INSTRUCTOR WORKSPACE</p><h1>{title}</h1></div>
        <Link href="/instructor/evaluations/weekly">เริ่มการประเมิน ↗</Link>
        <form className="logout-form" action="/api/auth/logout" method="post"><button type="submit">ออกจากระบบ</button></form>
      </header>
      <div className="system-content">{children}</div>
    </section>
    {menuOpen && <button className="system-scrim" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />}
  </main>;
}
