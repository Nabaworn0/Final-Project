import { env } from "cloudflare:workers";

export type MidtermCommitteeRecord = {
  id: string;
  courseId: string;
  cohort: string;
  groupNumber: number;
  slot: number;
  instructorId: string;
  updatedAt: number;
};

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) schemaReady = env.DB.prepare(`CREATE TABLE IF NOT EXISTS midterm_committees (
    id TEXT PRIMARY KEY NOT NULL,
    course_id TEXT NOT NULL,
    cohort TEXT NOT NULL,
    group_number INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    instructor_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run().then(async () => {
    await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_midterm_committee_slot ON midterm_committees(course_id,cohort,group_number,slot)").run();
  }).then(() => undefined);
  return schemaReady;
}

export async function listMidtermCommittees(courseId: string, cohort: string) {
  await ensureSchema();
  const result = await env.DB.prepare(`SELECT id, course_id AS courseId, cohort, group_number AS groupNumber,
    slot, instructor_id AS instructorId, updated_at AS updatedAt FROM midterm_committees
    WHERE course_id = ? AND cohort = ? ORDER BY group_number, slot`).bind(courseId, cohort).all<MidtermCommitteeRecord>();
  return result.results;
}

export async function saveMidtermCommittee(input: Omit<MidtermCommitteeRecord, "id" | "updatedAt">) {
  await ensureSchema();
  if (!input.instructorId) {
    await env.DB.prepare("DELETE FROM midterm_committees WHERE course_id = ? AND cohort = ? AND group_number = ? AND slot = ?")
      .bind(input.courseId, input.cohort, input.groupNumber, input.slot).run();
    return { removed: true };
  }
  const id = crypto.randomUUID();
  const updatedAt = Date.now();
  await env.DB.prepare(`INSERT INTO midterm_committees(id,course_id,cohort,group_number,slot,instructor_id,updated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(course_id,cohort,group_number,slot)
    DO UPDATE SET instructor_id = excluded.instructor_id, updated_at = excluded.updated_at`)
    .bind(id, input.courseId, input.cohort, input.groupNumber, input.slot, input.instructorId, updatedAt).run();
  return { id, updatedAt };
}
