import { InstructorShell } from "@/features/instructor/components/instructor-shell";
import { CourseManager } from "@/features/instructor/courses/course-manager";
import { requireRole } from "@/lib/server/auth";
import { canCreateCourse, CourseError } from "@/lib/server/course-store";
import { courseStore } from "@/lib/server/courses";
import "@/features/instructor/courses/courses.css";

export default async function Page({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const user = await requireRole("instructor");
  const store = courseStore();
  const courses = await store.listCourses(user);
  const selected = (await searchParams).course || courses[0]?.id;
  let workspace = null;
  let error = "";
  try { if (selected) workspace = await store.workspace(user, selected); }
  catch (e) { if (e instanceof CourseError) error = e.message; else throw e; }
  return <InstructorShell title="ห้องเรียน" userName={user.fullName} active="courses">
    <CourseManager key={selected || "new"} courses={courses} workspace={workspace} canCreate={canCreateCourse(user)} error={error} />
  </InstructorShell>;
}
