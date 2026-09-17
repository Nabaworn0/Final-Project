import { LessonPlanUploadForm } from "@/features/student/lesson-plans/components/lesson-plan-upload-form";
import { StudentWorkspaceShell } from "@/features/student/components/student-workspace-shell";
import { requireRole } from "@/lib/server/auth";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const user = await requireRole("student");
  const { error } = await searchParams;
  return <StudentWorkspaceShell title="อัปโหลดแผนการสอน" userName={user.fullName}>
    <LessonPlanUploadForm error={error} />
  </StudentWorkspaceShell>;
}
