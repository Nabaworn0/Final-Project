import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { IndividualAssessmentForm } from "@/features/instructor/evaluations/components/individual-assessment-form";
import { requireRole } from "@/lib/server/auth";

export default async function Page() {
  const user = await requireRole("instructor");
  return <InstructorShell title="ซ้อมสอนรายสัปดาห์" userName={user.fullName} active="weekly"><IndividualAssessmentForm mode="weekly" /></InstructorShell>;
}
