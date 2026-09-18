import { env } from "cloudflare:workers";

export type WeeklyFeedbackRecord = {
  id: string;
  courseId: string;
  studentId: string;
  instructorId: string;
  week: number;
  comment: string;
  updatedAt: number;
};

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) schemaReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS weekly_feedback (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    week INTEGER NOT NULL,
    comment TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run().then(async () => {
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_feedback_entry ON weekly_feedback(course_id,student_id,instructor_id,week)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_weekly_feedback_student ON weekly_feedback(course_id,student_id)").run();
  }).then(() => undefined);
  return schemaReady;
}

export async function listWeeklyFeedback(courseId: string, instructorId: string) {
  await ensureSchema();
  const result = await env.DB.prepare(`SELECT id, course_id AS courseId, student_id AS studentId, instructor_id AS instructorId,
    week, comment, updated_at AS updatedAt FROM weekly_feedback WHERE course_id = ? AND instructor_id = ? ORDER BY updated_at DESC`)
    .bind(courseId, instructorId).all<WeeklyFeedbackRecord>();
  return result.results;
}

export async function saveWeeklyFeedback(input: Omit<WeeklyFeedbackRecord, "id" | "updatedAt">) {
  await ensureSchema();
  const id = crypto.randomUUID();
  const updatedAt = Date.now();
  await env.DB.prepare(`INSERT INTO weekly_feedback(id,course_id,student_id,instructor_id,week,comment,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(course_id,student_id,instructor_id,week)
    DO UPDATE SET comment = excluded.comment, updated_at = excluded.updated_at`)
    .bind(id, input.courseId, input.studentId, input.instructorId, input.week, input.comment, updatedAt).run();
  return { id, updatedAt };
}
