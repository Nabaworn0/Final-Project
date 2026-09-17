import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createCourseStore } from "../lib/server/course-store.ts";

const owner = { id: "instructor-demo", role: "instructor", email: "instructor@email.kmutnb.ac.th", fullName: "ผู้รับผิดชอบ" };
const teacher = { id: "teacher", role: "instructor", email: "teacher@email.kmutnb.ac.th", fullName: "อาจารย์ประจำห้อง" };
function setup(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES ('instructor-demo'),('teacher')");
  sqlite.exec(readFileSync(new URL("../drizzle/0004_course_management.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0005_course_cohorts.sql", import.meta.url), "utf8"));
  const db = {
    prepare(sql) {
      let args = [];
      const stmt = sqlite.prepare(sql);
      return {
        bind(...values) { args = values; return this; },
        async first() { return stmt.get(...args) || null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { return stmt.run(...args); },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec("COMMIT"); return results; }
      catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    },
  };
  return { store: createCourseStore(db), db, sqlite };
}
const courseInput = { action: "create_course", code: "CED101", name: "ฝึกปฏิบัติการสอน", academicYear: 2569, semester: "1" };
async function populated(t) {
  const f = setup(t);
  const { courseId } = await f.store.mutate(owner, courseInput);
  const save = input => f.store.mutate(owner, { courseId, ...input });
  await save({ action: "save_person", role: "student", fullName: "นักศึกษา ก", email: "A@email.kmutnb.ac.th", studentNumber: "1001" });
  await save({ action: "save_person", role: "student", fullName: "นักศึกษา ข", email: "b@email.kmutnb.ac.th", studentNumber: "1002" });
  await save({ action: "save_person", role: "instructor", fullName: teacher.fullName, email: teacher.email });
  let w = await f.store.workspace(owner, courseId);
  const instructorId = w.people.find(p => p.email === teacher.email).id;
  await save({ action: "save_room", name: "ห้อง 1", instructorId });
  await save({ action: "save_room", name: "ห้อง 2" });
  w = await f.store.workspace(owner, courseId);
  return { ...f, courseId, save, w, instructorId, students: w.people.filter(p => p.role === "student") };
}
test("creation is coordinator-only, persists, and includes actual creator", async t => {
  const { store, db } = setup(t);
  await assert.rejects(store.mutate(teacher, courseInput), e => e.status === 403);
  await assert.rejects(store.mutate({ ...owner, role: "student" }, courseInput), e => e.status === 403);
  const { courseId } = await store.mutate(owner, courseInput);
  const w = await createCourseStore(db).workspace(owner, courseId);
  assert.equal(w.people.length, 1);
  assert.equal(w.people[0].email, owner.email);
  assert.equal(w.course.academicYear, 2569);
  await assert.rejects(store.mutate(owner, courseInput), /UNIQUE/);
});
test("input validation and duplicate people are enforced", async t => {
  const { store, save } = await populated(t);
  await assert.rejects(store.mutate(owner, { ...courseInput, academicYear: 2026 }), /ปีการศึกษา/);
  await assert.rejects(save({ action: "save_person", role: "student", fullName: "ซ้ำ", email: "a@EMAIL.KMUTNB.AC.TH", studentNumber: "1009" }), /UNIQUE/);
  await assert.rejects(save({ action: "save_person", role: "student", fullName: "ซ้ำ", email: "z@email.kmutnb.ac.th", studentNumber: "1001" }), /UNIQUE/);
  await assert.rejects(save({ action: "save_person", role: "admin", fullName: "x", email: teacher.email }), /บทบาท/);
});
test("one room per student per phase, can move and unassign", async t => {
  const { save, students, w, store, courseId } = await populated(t);
  await save({ action: "assign_student", studentId: students[0].id, roomId: w.rooms[0].id });
  await save({ action: "assign_student", studentId: students[0].id, roomId: w.rooms[1].id });
  let result = await store.workspace(owner, courseId);
  assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].roomId, w.rooms[1].id);
  await save({ action: "assign_student", studentId: students[0].id, roomId: "" });
  result = await store.workspace(owner, courseId);
  assert.equal(result.memberships.length, 0);
  assert.equal(result.people.filter(p => p.role === "student").length, 2);
});
test("room teachers see only assigned rooms and students, cannot mutate", async t => {
  const { save, students, w, store, courseId } = await populated(t);
  const ownRoom = w.rooms.find(r => r.instructorId);
  await save({ action: "assign_student", studentId: students[0].id, roomId: ownRoom.id });
  const result = await store.workspace(teacher, courseId);
  assert.equal(result.canManage, false);
  assert.equal(result.rooms.length, 1);
  assert.equal(result.people.filter(p => p.role === "student").length, 1);
  assert(!result.people.some(p => p.id === students[1].id));
  assert.equal((await store.listCourses(teacher)).length, 1);
  await assert.rejects(store.mutate(teacher, { action: "save_room", courseId, name: "forbidden" }), e => e.status === 403);
  await assert.rejects(store.workspace({ ...teacher, email: "other@email.kmutnb.ac.th" }, courseId), e => e.status === 403);
});
test("room assignment validates participant roles and course boundaries", async t => {
  const { save, students, store, instructorId } = await populated(t);
  await assert.rejects(save({ action: "save_room", name: "bad", instructorId: students[0].id }), /อาจารย์/);
  await assert.rejects(save({ action: "assign_student", studentId: instructorId, roomId: "" }), /นักศึกษา/);
  const { courseId: other } = await store.mutate(owner, { ...courseInput, code: "CED102" });
  await store.mutate(owner, { action: "save_room", courseId: other, name: "other" });
  const otherRoom = (await store.workspace(owner, other)).rooms[0];
  await assert.rejects(save({ action: "assign_student", studentId: students[0].id, roomId: otherRoom.id }), /รายวิชา/);
  await assert.rejects(save({ action: "save_room", id: otherRoom.id, name: "bad" }), /ไม่พบห้อง/);
});
test("editing roster and rooms retains identities and placements", async t => {
  const { save, students, w, store, courseId } = await populated(t);
  await save({ action: "assign_student", studentId: students[0].id, roomId: w.rooms[0].id });
  await save({ ...students[0], action: "save_person", fullName: "แก้ชื่อแล้ว" });
  await save({ ...w.rooms[0], action: "save_room", name: "ห้องใหม่" });
  const result = await store.workspace(owner, courseId);
  assert.equal(result.people.find(p => p.id === students[0].id).fullName, "แก้ชื่อแล้ว");
  assert.equal(result.rooms.find(r => r.id === w.rooms[0].id).name, "ห้องใหม่");
  assert.equal(result.memberships.length, 1);
});
test("later phase remains independent of before-midterm placements", async t => {
  const { sqlite, save, students, courseId, w, store } = await populated(t);
  sqlite.prepare("INSERT INTO course_rooms(id,course_id,name,phase) VALUES ('later',?,'หลังกลางภาค','after_midterm')").run(courseId);
  sqlite.prepare("INSERT INTO room_memberships VALUES ('later-member',?,?,'later','after_midterm')").run(courseId, students[0].id);
  await save({ action: "assign_student", studentId: students[0].id, roomId: w.rooms[0].id });
  assert.equal((await store.workspace(owner, courseId)).memberships.length, 2);
  await save({ action: "assign_student", studentId: students[0].id, roomId: "" });
  assert.equal((await store.workspace(owner, courseId)).memberships[0].phase, "after_midterm");
});
test("Excel roster import creates new students and updates matching rows", async t => {
  const { save, store, courseId } = await populated(t);
  const result = await save({ action: "import_students", rows: [
    { fullName: "นักศึกษา ก แก้ไข", studentNumber: "1001", cohort: "CED-2DERA" },
    { fullName: "นักศึกษา ค", studentNumber: "1003", cohort: "TCT-1DERA" },
  ] });
  assert.deepEqual({ imported: result.importedCount, created: result.createdCount, updated: result.updatedCount }, { imported: 2, created: 1, updated: 1 });
  const students = (await store.workspace(owner, courseId)).people.filter(person => person.role === "student");
  assert.equal(students.length, 3);
  assert.equal(students.find(person => person.studentNumber === "1001").fullName, "นักศึกษา ก แก้ไข");
  assert.equal(students.find(person => person.studentNumber === "1001").cohort, "CED-2DERA");
  assert.equal(students.find(person => person.studentNumber === "1003").email, "1003@email.kmutnb.ac.th");
});
test("Excel roster import rejects duplicate rows and instructor email collisions", async t => {
  const { save } = await populated(t);
  await assert.rejects(save({ action: "import_students", rows: [
    { fullName: "หนึ่ง", studentNumber: "2001", email: "same@email.kmutnb.ac.th" },
    { fullName: "สอง", studentNumber: "2002", email: "same@email.kmutnb.ac.th" },
  ] }), /ซ้ำในไฟล์/);
  await assert.rejects(save({ action: "import_students", rows: [
    { fullName: "ผิดบทบาท", studentNumber: "2003", email: teacher.email },
  ] }), /บัญชีอาจารย์/);
});
