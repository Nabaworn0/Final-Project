import { LessonPlanList } from "@/features/student/lesson-plans/components/lesson-plan-list";
import { StudentWorkspaceShell } from "@/features/student/components/student-workspace-shell";
import { requireRole } from "@/lib/server/auth";
import { listLessonPlans } from "@/lib/server/lesson-plans";

export default async function Page() {
  const user = await requireRole("student");
  const plans = await listLessonPlans(user.id);
  return <StudentWorkspaceShell title="แผนการสอน" userName={user.fullName}>
    <LessonPlanList plans={plans} />
  </StudentWorkspaceShell>;
}
