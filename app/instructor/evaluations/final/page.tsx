import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { FinalPairAssessmentForm } from "@/features/instructor/evaluations/components/final-pair-assessment-form";
import { requireRole } from "@/lib/server/auth";

export default async function Page() {
  const user = await requireRole("instructor");
  return <InstructorShell title="สอบปลายภาค" userName={user.fullName} active="final"><FinalPairAssessmentForm /></InstructorShell>;
}
