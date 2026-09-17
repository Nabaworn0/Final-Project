import type { Course, CourseActor, CoursePerson, CourseRoom, CourseWorkspace, RoomMembership } from "../../features/instructor/courses/types";

interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface CourseDatabase { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown>; }
export class CourseError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
// Temporary bootstrap permission, removed when real coordinator provisioning is added.
export const canCreateCourse = (actor: CourseActor) => actor.role === "instructor" && actor.id === "instructor-demo";
const courseColumns = "id, code, name, academic_year AS academicYear, semester, owner_id AS ownerId";
const personColumns = "id, course_id AS courseId, role, full_name AS fullName, email, student_number AS studentNumber, cohort";
const roomColumns = "id, course_id AS courseId, name, phase, instructor_id AS instructorId, cohort";
const membershipColumns = "id, course_id AS courseId, student_id AS studentId, room_id AS roomId, phase";
function value(input: Record<string, unknown>, key: string, max = 160) {
  const raw = input[key];
  if (typeof raw !== "string" || !raw.trim() || raw.trim().length > max) throw new CourseError(`กรุณาระบุ ${key} ให้ถูกต้อง (ไม่เกิน ${max} ตัวอักษร)`);
  return raw.trim();
}
function optionalValue(input: Record<string, unknown>, key: string, max = 80) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || raw.trim().length > max) throw new CourseError(`กรุณาระบุ ${key} ให้ถูกต้อง (ไม่เกิน ${max} ตัวอักษร)`);
  return raw.trim();
}
function instructor(actor: CourseActor) {
  if (actor.role !== "instructor") throw new CourseError("เฉพาะอาจารย์เท่านั้น", 403);
}

export function createCourseStore(db: CourseDatabase) {
  const rows = async <T>(sql: string, ...args: (string | number | null)[]) => (await db.prepare(sql).bind(...args).all<T>()).results;
  async function courseFor(actor: CourseActor, id: string) {
    instructor(actor);
    const course = await db.prepare(`SELECT ${courseColumns} FROM courses WHERE id = ?`).bind(id).first<Course>();
    if (!course) throw new CourseError("ไม่พบรายวิชา", 404);
    return course;
  }
  async function listCourses(actor: CourseActor) {
    instructor(actor);
    return rows<Course>(`SELECT ${courseColumns} FROM courses WHERE owner_id = ? OR id IN (
      SELECT r.course_id FROM course_rooms r JOIN course_people p ON p.id = r.instructor_id AND p.course_id = r.course_id
      WHERE p.email = ? AND p.role = 'instructor'
    ) ORDER BY academic_year DESC, semester DESC, code`, actor.id, actor.email.toLowerCase());
  }
  async function workspace(actor: CourseActor, id: string): Promise<CourseWorkspace> {
    const course = await courseFor(actor, id);
    const canManage = course.ownerId === actor.id;
    const rooms = await rows<CourseRoom>(`SELECT ${roomColumns} FROM course_rooms WHERE course_id = ? ORDER BY name`, id);
    const people = await rows<CoursePerson>(`SELECT ${personColumns} FROM course_people WHERE course_id = ? ORDER BY full_name`, id);
    const memberships = await rows<RoomMembership>(`SELECT ${membershipColumns} FROM room_memberships WHERE course_id = ?`, id);
    if (canManage) return { course, rooms, people, memberships, canManage };
    const own = people.find(p => p.role === "instructor" && p.email === actor.email.toLowerCase());
    const visibleRooms = rooms.filter(r => r.instructorId === own?.id);
    if (!own || !visibleRooms.length) throw new CourseError("คุณไม่ได้รับมอบหมายห้องในรายวิชานี้", 403);
    const visibleMemberships = memberships.filter(m => visibleRooms.some(r => r.id === m.roomId));
    return { course, canManage, rooms: visibleRooms, memberships: visibleMemberships,
      people: people.filter(p => p.id === own.id || visibleMemberships.some(m => m.studentId === p.id)) };
  }
  async function mutate(actor: CourseActor, input: Record<string, unknown>) {
    instructor(actor);
    const action = value(input, "action", 40);
    if (action === "create_course") {
      if (!canCreateCourse(actor)) throw new CourseError("บัญชีนี้ไม่มีสิทธิ์สร้างรายวิชา", 403);
      const id = crypto.randomUUID();
      const code = value(input, "code", 30).toUpperCase();
      const name = value(input, "name");
      const academicYear = Number(input.academicYear);
      const semester = value(input, "semester", 10);
      if (!Number.isInteger(academicYear) || academicYear < 2500 || academicYear > 2700 || !["1", "2", "summer"].includes(semester)) throw new CourseError("ตรวจสอบปีการศึกษา (พ.ศ.) และภาคเรียน");
      await db.batch([
        db.prepare("INSERT INTO courses(id,code,name,academic_year,semester,owner_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(id, code, name, academicYear, semester, actor.id, Date.now()),
        db.prepare("INSERT INTO course_people(id,course_id,role,full_name,email) VALUES (?,?,'instructor',?,?)").bind(crypto.randomUUID(), id, actor.fullName, actor.email.toLowerCase()),
      ]);
      return { courseId: id };
    }
    const courseId = value(input, "courseId", 100);
    const course = await courseFor(actor, courseId);
    if (course.ownerId !== actor.id) throw new CourseError("เฉพาะผู้รับผิดชอบรายวิชาเท่านั้นที่แก้ไขได้", 403);
    if (action === "save_person") {
      const role = value(input, "role", 20);
      if (role !== "student" && role !== "instructor") throw new CourseError("บทบาทไม่ถูกต้อง");
      const name = value(input, "fullName");
      const email = value(input, "email", 254).toLowerCase();
      if (!/^[^\s@]+@email\.kmutnb\.ac\.th$/.test(email)) throw new CourseError("กรุณาใช้อีเมล @email.kmutnb.ac.th");
      const number = role === "student" ? value(input, "studentNumber", 30) : null;
      const cohort = role === "student" ? optionalValue(input, "cohort") : null;
      if (input.id) {
        const id = value(input, "id", 100);
        const existing = await db.prepare("SELECT role FROM course_people WHERE id = ? AND course_id = ?").bind(id, courseId).first<{ role: string }>();
        if (!existing || existing.role !== role) throw new CourseError("ไม่พบรายชื่อหรือบทบาทไม่ตรงกัน");
        await db.prepare("UPDATE course_people SET full_name = ?, email = ?, student_number = ?, cohort = COALESCE(?, cohort) WHERE id = ? AND course_id = ?").bind(name, email, number, cohort, id, courseId).run();
      } else {
        await db.prepare("INSERT INTO course_people(id,course_id,role,full_name,email,student_number,cohort) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), courseId, role, name, email, number, cohort).run();
      }
    } else if (action === "import_students") {
      if (!Array.isArray(input.rows) || input.rows.length < 1 || input.rows.length > 300) throw new CourseError("ไฟล์ต้องมีรายชื่อนักศึกษา 1–300 คน");
      const imported = input.rows.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CourseError(`ข้อมูล Excel แถวที่ ${index + 2} ไม่ถูกต้อง`);
        const row = raw as Record<string, unknown>;
        const fullName = value(row, "fullName");
        const studentNumber = value(row, "studentNumber", 30);
        const suppliedEmail = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
        const cohort = optionalValue(row, "cohort") || course.code;
        const email = suppliedEmail || `${studentNumber}@email.kmutnb.ac.th`;
        if (!/^[^\s@]+@email\.kmutnb\.ac\.th$/.test(email)) throw new CourseError(`ข้อมูลแถวที่ ${index + 2} ไม่ถูกต้อง`);
        return { fullName, studentNumber, email, suppliedEmail, cohort };
      });
      const emails = new Set<string>();
      const numbers = new Set<string>();
      for (const [index, row] of imported.entries()) {
        if (emails.has(row.email) || numbers.has(row.studentNumber)) throw new CourseError(`อีเมลหรือรหัสนักศึกษาซ้ำในไฟล์ แถวที่ ${index + 2}`);
        emails.add(row.email); numbers.add(row.studentNumber);
      }
      const existing = await rows<CoursePerson>(`SELECT ${personColumns} FROM course_people WHERE course_id = ?`, courseId);
      const statements: Statement[] = [];
      const matchedIds = new Set<string>();
      let createdCount = 0;
      let updatedCount = 0;
      for (const row of imported) {
        const numberMatch = existing.find(person => person.role === "student" && person.studentNumber === row.studentNumber);
        const emailMatch = row.suppliedEmail ? existing.find(person => person.email === row.email) : undefined;
        if (emailMatch?.role === "instructor") throw new CourseError(`อีเมล ${row.email} เป็นบัญชีอาจารย์ในรายวิชานี้`);
        if (emailMatch && numberMatch && emailMatch.id !== numberMatch.id) throw new CourseError(`อีเมลและรหัส ${row.studentNumber} ตรงกับคนละรายชื่อ กรุณาตรวจไฟล์`);
        const matched = emailMatch || numberMatch;
        if (matched) {
          if (matchedIds.has(matched.id)) throw new CourseError(`มีหลายแถวในไฟล์ตรงกับรายชื่อ ${matched.fullName} กรุณาตรวจอีเมลและรหัสนักศึกษา`);
          matchedIds.add(matched.id);
          statements.push(db.prepare("UPDATE course_people SET full_name = ?, email = ?, student_number = ?, cohort = ? WHERE id = ? AND course_id = ? AND role = 'student'").bind(row.fullName, row.suppliedEmail || matched.email, row.studentNumber, row.cohort, matched.id, courseId));
          updatedCount += 1;
        } else {
          statements.push(db.prepare("INSERT INTO course_people(id,course_id,role,full_name,email,student_number,cohort) VALUES (?,?,'student',?,?,?,?)").bind(crypto.randomUUID(), courseId, row.fullName, row.email, row.studentNumber, row.cohort));
          createdCount += 1;
        }
      }
      await db.batch(statements);
      return { courseId, importedCount: imported.length, createdCount, updatedCount };
    } else if (action === "save_room") {
      const name = value(input, "name", 80);
      const instructorId = input.instructorId ? value(input, "instructorId", 100) : null;
      const cohort = optionalValue(input, "cohort");
      if (instructorId && !await db.prepare("SELECT id FROM course_people WHERE id = ? AND course_id = ? AND role = 'instructor'").bind(instructorId, courseId).first()) throw new CourseError("เลือกอาจารย์ในรายวิชานี้เท่านั้น");
      if (input.id) {
        const id = value(input, "id", 100);
        if (!await db.prepare("SELECT id FROM course_rooms WHERE id = ? AND course_id = ? AND phase = 'before_midterm'").bind(id, courseId).first()) throw new CourseError("ไม่พบห้องในช่วงก่อนกลางภาค");
        await db.prepare("UPDATE course_rooms SET name = ?, instructor_id = ?, cohort = COALESCE(?, cohort) WHERE id = ? AND course_id = ?").bind(name, instructorId, cohort, id, courseId).run();
      } else {
        await db.prepare("INSERT INTO course_rooms(id,course_id,name,phase,instructor_id,cohort) VALUES (?,?,?,'before_midterm',?,?)").bind(crypto.randomUUID(), courseId, name, instructorId, cohort).run();
      }
    } else if (action === "assign_student") {
      const studentId = value(input, "studentId", 100);
      if (!await db.prepare("SELECT id FROM course_people WHERE id = ? AND course_id = ? AND role = 'student'").bind(studentId, courseId).first()) throw new CourseError("เลือกนักศึกษาในรายวิชานี้เท่านั้น");
      const roomId = input.roomId ? value(input, "roomId", 100) : null;
      if (roomId) {
        if (!await db.prepare("SELECT id FROM course_rooms WHERE id = ? AND course_id = ? AND phase = 'before_midterm'").bind(roomId, courseId).first()) throw new CourseError("เลือกห้องในรายวิชาและช่วงเดียวกันเท่านั้น");
        await db.prepare(`INSERT INTO room_memberships(id,course_id,student_id,room_id,phase) VALUES (?,?,?,?,'before_midterm')
          ON CONFLICT(course_id,student_id,phase) DO UPDATE SET room_id = excluded.room_id`).bind(crypto.randomUUID(), courseId, studentId, roomId).run();
      } else {
        await db.prepare("DELETE FROM room_memberships WHERE course_id = ? AND student_id = ? AND phase = 'before_midterm'").bind(courseId, studentId).run();
      }
    } else throw new CourseError("ไม่รองรับการทำรายการนี้");
    return { courseId };
  }
  return { listCourses, workspace, mutate };
}
