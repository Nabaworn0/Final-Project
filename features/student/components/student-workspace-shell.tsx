"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";

const navigation = [
  ["/student/lesson-plans", "แผนการสอน"],
  ["/student/teaching-sessions", "วิเคราะห์การฝึกสอน"],
  ["/student/performance", "คะแนน"],
  ["/student/profile", "โปรไฟล์"],
] as const;

export function StudentWorkspaceShell({ title, userName, active = "lesson-plans", children }: {
  title: string;
  userName: string;
  active?: "lesson-plans" | "dashboard";
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <main className={`system-shell ${menuOpen ? "menu-open" : ""}`}>
    <aside className="system-sidebar">
      <Link className="wordmark system-brand" href="/">
        <Image className="brand-logo brand-logo-sidebar" src="/ced-logo-mark.png" width={64} height={64} alt="ตราภาควิชาคอมพิวเตอร์ศึกษา" />
        <span className="brand-copy-web"><strong>CED Assessment</strong><small>FTE · KMUTNB</small></span>
      </Link>
      <p className="role-chip">STUDENT PORTAL</p>
      <nav>{navigation.map(([href, label], index) => <Link key={href} href={href}
        className={(active === "lesson-plans" && href.includes("lesson-plans")) || (active === "dashboard" && href.includes("dashboard")) ? "active" : ""}>
        <span>0{index + 1}</span>{label}
      </Link>)}</nav>
      <div className="system-user"><span>{userName.trim().charAt(0) || "น"}</span><div><strong>{userName}</strong><small>นักศึกษาฝึกสอน</small></div></div>
    </aside>
    <section className="system-main">
      <header className="system-topbar">
        <button className="system-menu" type="button" aria-expanded={menuOpen} aria-label="เปิดเมนู" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        <div><p>STUDENT WORKSPACE</p><h1>{title}</h1></div>
        <Link href="/student/dashboard">พื้นที่นักศึกษา ↗</Link>
        <form className="logout-form" action="/api/auth/logout" method="post"><button type="submit">ออกจากระบบ</button></form>
      </header>
      <div className="system-content">{children}</div>
    </section>
    {menuOpen && <button className="system-scrim" aria-label="ปิดเมนู" onClick={() => setMenuOpen(false)} />}
  </main>;
}
