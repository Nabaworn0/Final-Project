import { requireRole } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function InstructorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("instructor");
  return children;
}
