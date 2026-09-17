import { requireRole } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("student");
  return children;
}
