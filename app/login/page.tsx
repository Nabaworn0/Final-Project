import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "student" ? "/student/dashboard" : "/instructor/students");
  const { error } = await searchParams;
  const errorMessage = error === "unavailable"
    ? "ระบบฐานข้อมูลไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่อีกครั้ง"
    : error === "invalid" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : null;

  return <main className="login-page">
    <Link className="wordmark" href="/">
      <Image className="brand-logo brand-logo-login" src="/ced-logo-mark.png" width={96} height={96} alt="ตราภาควิชาคอมพิวเตอร์ศึกษา" priority />
      <span className="brand-copy-web"><strong>Computer Education</strong><small>FTE · KMUTNB</small></span>
    </Link>
    <Image className="login-watermark" src="/ced-logo-mark.png" width={820} height={820} alt="" aria-hidden="true" />
    <section className="login-card">
      <h1>เข้าสู่ระบบ</h1>
      {errorMessage && <div className="login-error" role="alert">{errorMessage}</div>}
      <form action="/api/auth/login" method="post">
        <label>อีเมลมหาวิทยาลัย<input name="email" type="email" autoComplete="username" defaultValue="student@email.kmutnb.ac.th" pattern="[^@\s]+@email\.kmutnb\.ac\.th" required /></label>
        <label>รหัสผ่าน<input name="password" type="password" autoComplete="current-password" defaultValue="demo1234" required /></label>
        <button type="submit">เข้าสู่ระบบ →</button>
      </form>
      <div className="demo-accounts">
        <strong>บัญชีสำหรับทดลอง</strong>
        <div><b>นักศึกษา</b><span>student@email.kmutnb.ac.th</span></div>
        <div><b>อาจารย์</b><span>instructor@email.kmutnb.ac.th</span></div>
        <small>รหัสผ่านสำหรับทั้งสองบัญชี: demo1234</small>
      </div>
    </section>
  </main>;
}
