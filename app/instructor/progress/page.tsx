import { InstructorEmptySection } from "@/features/instructor/components/instructor-empty-section";
import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { requireRole } from "@/lib/server/auth";

export default async function Page() {
  const user = await requireRole("instructor");
  return <InstructorShell title="พัฒนาการและ Feedback" userName={user.fullName} active="progress"><InstructorEmptySection label="PROGRESS & FEEDBACK" title="ยังไม่มีข้อมูลพัฒนาการ" description="ระบบจะแสดงกราฟรายครั้ง คะแนนรายด้าน Feedback ย้อนหลัง และเป้าหมายจากการประเมินครั้งก่อนเมื่อมีผลอย่างน้อยสองครั้ง" actionHref="/instructor/evaluations/weekly" actionLabel="เริ่มการประเมิน" /></InstructorShell>;
}
