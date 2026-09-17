import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { EvidenceWorkspace } from "@/features/instructor/evidence/components/evidence-workspace";
import { requireRole } from "@/lib/server/auth";

export default async function Page() {
  const user = await requireRole("instructor");
  return <InstructorShell title="หลักฐานการสอน" userName={user.fullName} active="evidence"><EvidenceWorkspace /></InstructorShell>;
}
