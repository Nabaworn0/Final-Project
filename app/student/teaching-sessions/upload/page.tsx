import { StudentPortal } from "@/features/student/components/student-portal";
import { requireRole } from "@/lib/server/auth";
import { listLessonPlans } from "@/lib/server/lesson-plans";

export default async function Page() {
  const user = await requireRole("student");
  const plans = await listLessonPlans(user.id);
  return <StudentPortal kind="video-upload" lessonPlans={plans.map(({ id, title }) => ({ id, title }))} />;
}
