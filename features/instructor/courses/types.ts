export type CourseActor = { id: string; email: string; role: string; fullName: string };
export type Course = { id: string; code: string; name: string; academicYear: number; semester: string; ownerId: string };
export type CoursePerson = { id: string; courseId: string; role: "student" | "instructor"; fullName: string; email: string; studentNumber: string | null; cohort: string | null };
export type CourseRoom = { id: string; courseId: string; name: string; phase: "before_midterm" | "after_midterm"; instructorId: string | null; cohort: string | null };
export type RoomMembership = { id: string; courseId: string; studentId: string; roomId: string; phase: string };
export type CourseWorkspace = { course: Course; people: CoursePerson[]; rooms: CourseRoom[]; memberships: RoomMembership[]; canManage: boolean };
