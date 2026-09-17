import Link from "next/link";
import type { LessonPlanSummary } from "@/lib/server/lesson-plans";

const statusText: Record<string, string> = {
  draft: "พร้อมใช้เปรียบเทียบ",
  analyzed: "พร้อมใช้เปรียบเทียบ",
  submitted: "ส่งให้อาจารย์แล้ว",
  revision: "รอแก้ไข",
  approved: "อนุมัติแล้ว",
};

export function LessonPlanList({ plans }: { plans: LessonPlanSummary[] }) {
  return <section className="system-card">
    <div className="list-heading"><div><p className="card-label">LESSON PLAN REFERENCES</p><h2>แผนการสอนที่อัปโหลดไว้</h2></div><Link className="solid-link" href="/student/lesson-plans/upload">+ อัปโหลดแผนใหม่</Link></div>
    {plans.length === 0 ? <div className="empty-plans"><strong>ยังไม่มีแผนการสอน</strong><p>อัปโหลดแผนก่อน เพื่อใช้เป็นเอกสารอ้างอิงเมื่อเพิ่มคลิปฝึกสอน</p><Link href="/student/lesson-plans/upload">อัปโหลดแผนแรก →</Link></div>
      : <div className="plans-list">{plans.map((plan, index) => <article className="plan-row" key={plan.id}>
        <span className="plan-order">{String(index + 1).padStart(2, "0")}</span>
        <div><small>เอกสารอ้างอิง · {plan.course}</small><h3>{plan.title}</h3><p>พร้อมเลือกใช้กับคลิปเสียงหรือวิดีโอ</p></div>
        <span className="status-good">{statusText[plan.status] ?? plan.status}</span>
        <Link className="plan-use-link" aria-label={`ใช้แผน ${plan.title} เปรียบเทียบกับคลิป`} href={`/student/teaching-sessions/upload?plan=${plan.id}`}>ใช้กับคลิป →</Link>
      </article>)}</div>}
  </section>;
}
