import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "instructor"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_sessions_user_id").on(table.userId), index("idx_sessions_expires_at").on(table.expiresAt)],
);

export const lessonPlans = sqliteTable(
  "lesson_plans",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    course: text("course").notNull(),
    learnerLevel: text("learner_level").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    status: text("status", { enum: ["draft", "analyzed", "submitted", "revision", "approved"] }).notNull().default("analyzed"),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_lesson_plans_owner_updated").on(table.ownerId, table.updatedAt),
    index("idx_lesson_plans_status").on(table.status),
  ],
);

export const lessonPlanVersions = sqliteTable(
  "lesson_plan_versions",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => lessonPlans.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    objectives: text("objectives").notNull(),
    motivation: text("motivation").notNull(),
    information: text("information").notNull(),
    application: text("application").notNull(),
    progress: text("progress").notNull(),
    assessment: text("assessment").notNull(),
    timeAllocation: text("time_allocation").notNull(),
    sourceFileKey: text("source_file_key"),
    sourceFileName: text("source_file_name"),
    sourceMimeType: text("source_mime_type"),
    sourceFileSize: integer("source_file_size"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_lesson_plan_versions_plan_version").on(table.planId, table.versionNumber),
  ],
);

export const analysisRuns = sqliteTable(
  "analysis_runs",
  {
    id: text("id").primaryKey(),
    planVersionId: text("plan_version_id").notNull().references(() => lessonPlanVersions.id, { onDelete: "cascade" }),
    analyzerType: text("analyzer_type", { enum: ["rule_v1", "llm"] }).notNull(),
    rubricVersion: text("rubric_version").notNull(),
    structureScore: integer("structure_score").notNull(),
    alignmentScore: integer("alignment_score").notNull(),
    summary: text("summary").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_analysis_runs_plan_version").on(table.planVersionId, table.createdAt)],
);

export const documentExtractions = sqliteTable(
  "document_extractions",
  {
    id: text("id").primaryKey(),
    planVersionId: text("plan_version_id").notNull().references(() => lessonPlanVersions.id, { onDelete: "cascade" }),
    format: text("format", { enum: ["pdf", "docx"] }).notNull(),
    pageCount: integer("page_count"),
    extractedText: text("extracted_text").notNull(),
    confidence: text("confidence", { enum: ["low", "medium", "high"] }).notNull(),
    warnings: text("warnings").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("idx_document_extractions_plan_version").on(table.planVersionId)],
);

export const fileRetentions = sqliteTable(
  "file_retentions",
  {
    id: text("id").primaryKey(),
    planVersionId: text("plan_version_id").notNull().references(() => lessonPlanVersions.id, { onDelete: "cascade" }),
    fileKey: text("file_key").notNull(),
    deleteAfter: integer("delete_after").notNull(),
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_file_retentions_plan_version").on(table.planVersionId),
    index("idx_file_retentions_delete_after").on(table.deleteAfter),
  ],
);

export const criterionResults = sqliteTable(
  "criterion_results",
  {
    id: text("id").primaryKey(),
    analysisRunId: text("analysis_run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    stage: text("stage").notNull(),
    title: text("title").notNull(),
    score: integer("score").notNull(),
    status: text("status").notNull(),
    rationale: text("rationale").notNull(),
    evidence: text("evidence").notNull(),
    suggestion: text("suggestion").notNull(),
    confidence: text("confidence", { enum: ["low", "medium", "high"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_criterion_results_analysis").on(table.analysisRunId),
    uniqueIndex("idx_criterion_results_analysis_code").on(table.analysisRunId, table.code),
  ],
);

export type UserRole = "student" | "instructor";

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  academicYear: integer("academic_year").notNull(),
  semester: text("semester").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: integer("created_at").notNull(),
}, (t) => [uniqueIndex("idx_courses_code_term").on(t.code, t.academicYear, t.semester), index("idx_courses_owner").on(t.ownerId)]);

export const coursePeople = sqliteTable("course_people", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id),
  role: text("role", { enum: ["student", "instructor"] }).notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  studentNumber: text("student_number"),
  cohort: text("cohort"),
}, (t) => [
  uniqueIndex("idx_course_people_email").on(t.courseId, t.email),
  uniqueIndex("idx_course_people_number").on(t.courseId, t.studentNumber),
  uniqueIndex("idx_course_people_identity").on(t.id, t.courseId),
  index("idx_course_people_access").on(t.email, t.role),
  index("idx_course_people_cohort").on(t.courseId, t.cohort),
  check("course_people_role", sql`${t.role} IN ('student','instructor')`),
]);

export const courseRooms = sqliteTable("course_rooms", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id),
  name: text("name").notNull(),
  phase: text("phase", { enum: ["before_midterm", "after_midterm"] }).notNull(),
  instructorId: text("instructor_id"),
  cohort: text("cohort"),
}, (t) => [
  uniqueIndex("idx_course_rooms_name").on(t.courseId, t.phase, t.name),
  uniqueIndex("idx_course_rooms_identity").on(t.id, t.courseId, t.phase),
  index("idx_course_rooms_cohort").on(t.courseId, t.cohort),
  foreignKey({ columns: [t.instructorId, t.courseId], foreignColumns: [coursePeople.id, coursePeople.courseId] }),
  check("course_rooms_phase", sql`${t.phase} IN ('before_midterm','after_midterm')`),
]);

export const roomMemberships = sqliteTable("room_memberships", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull(),
  studentId: text("student_id").notNull(),
  roomId: text("room_id").notNull(),
  phase: text("phase").notNull(),
}, (t) => [
  uniqueIndex("idx_room_memberships_student_phase").on(t.courseId, t.studentId, t.phase),
  index("idx_room_memberships_room").on(t.roomId),
  foreignKey({ columns: [t.studentId, t.courseId], foreignColumns: [coursePeople.id, coursePeople.courseId] }),
  foreignKey({ columns: [t.roomId, t.courseId, t.phase], foreignColumns: [courseRooms.id, courseRooms.courseId, courseRooms.phase] }),
]);

export const weeklyFeedback = sqliteTable("weekly_feedback", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull(),
  instructorId: text("instructor_id").notNull(),
  week: integer("week").notNull(),
  comment: text("comment").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  uniqueIndex("idx_weekly_feedback_entry").on(t.courseId, t.studentId, t.instructorId, t.week),
  index("idx_weekly_feedback_student").on(t.courseId, t.studentId),
  foreignKey({ columns: [t.studentId, t.courseId], foreignColumns: [coursePeople.id, coursePeople.courseId] }),
]);

export const midtermCommittees = sqliteTable("midterm_committees", {
  id: text("id").primaryKey(),
  courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  cohort: text("cohort").notNull(),
  groupNumber: integer("group_number").notNull(),
  slot: integer("slot").notNull(),
  instructorId: text("instructor_id").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  uniqueIndex("idx_midterm_committee_slot").on(t.courseId, t.cohort, t.groupNumber, t.slot),
  foreignKey({ columns: [t.instructorId, t.courseId], foreignColumns: [coursePeople.id, coursePeople.courseId] }),
]);
export type LessonPlanStatus = "draft" | "analyzed" | "submitted" | "revision" | "approved";
