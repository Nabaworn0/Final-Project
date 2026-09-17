import { env } from "cloudflare:workers";
import { initializeAuthDatabase } from "./auth";
import { analyzeMiapPlan, type MiapAnalysis, type MiapPlanInput } from "../analysis/miap-analysis";

type R2Like = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

export const FILE_RETENTION_DAYS = 180;
const FILE_RETENTION_MS = FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type CreateLessonPlanInput = MiapPlanInput & {
  title: string;
  course: string;
  learnerLevel: string;
  attachment?: File;
  extraction?: {
    format: "pdf" | "docx";
    pageCount: number | null;
    text: string;
    confidence: "low" | "medium" | "high";
    warnings: string[];
  };
};

export type StoreLessonPlanReferenceInput = {
  title: string;
  course: string;
  attachment: File;
};

export type LessonPlanSummary = {
  id: string;
  title: string;
  course: string;
  learnerLevel: string;
  durationMinutes: number;
  status: string;
  currentVersion: number;
  structureScore: number;
  alignmentScore: number;
  updatedAt: number;
};

export type LessonPlanDetail = LessonPlanSummary & {
  objectives: string;
  motivation: string;
  information: string;
  application: string;
  progress: string;
  assessment: string;
  timeAllocation: string;
  sourceFileName: string | null;
  sourceFileExpiresAt: number | null;
  extractionFormat: string | null;
  extractionPageCount: number | null;
  extractionConfidence: string | null;
  extractionWarnings: string[];
  extractedTextPreview: string | null;
  analyzerType: string;
  rubricVersion: string;
  analysisSummary: string;
  results: Array<{
    code: string;
    stage: string;
    title: string;
    score: number;
    status: string;
    rationale: string;
    evidence: string;
    suggestion: string;
    confidence: string;
  }>;
};

let initialization: Promise<void> | null = null;
let nextRetentionSweepAt = 0;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

function getR2(): R2Like {
  const files = (env as typeof env & { FILES?: R2Like }).FILES;
  if (!files) throw new Error("Cloudflare R2 binding `FILES` is unavailable.");
  return files;
}

export function initializeLessonPlanDatabase(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    await initializeAuthDatabase();
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS lesson_plans (
        id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL,
        course TEXT NOT NULL, learner_level TEXT NOT NULL, duration_minutes INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'analyzed' CHECK (status IN ('draft','analyzed','submitted','revision','approved')),
        current_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS lesson_plan_versions (
        id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL, version_number INTEGER NOT NULL,
        objectives TEXT NOT NULL, motivation TEXT NOT NULL, information TEXT NOT NULL,
        application TEXT NOT NULL, progress TEXT NOT NULL, assessment TEXT NOT NULL,
        time_allocation TEXT NOT NULL, source_file_key TEXT, source_file_name TEXT,
        source_mime_type TEXT, source_file_size INTEGER, created_at INTEGER NOT NULL,
        FOREIGN KEY (plan_id) REFERENCES lesson_plans(id) ON DELETE CASCADE,
        UNIQUE(plan_id, version_number)
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS analysis_runs (
        id TEXT PRIMARY KEY NOT NULL, plan_version_id TEXT NOT NULL,
        analyzer_type TEXT NOT NULL CHECK (analyzer_type IN ('rule_v1','llm')),
        rubric_version TEXT NOT NULL, structure_score INTEGER NOT NULL,
        alignment_score INTEGER NOT NULL, summary TEXT NOT NULL, created_at INTEGER NOT NULL,
        FOREIGN KEY (plan_version_id) REFERENCES lesson_plan_versions(id) ON DELETE CASCADE
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS document_extractions (
        id TEXT PRIMARY KEY NOT NULL, plan_version_id TEXT NOT NULL UNIQUE,
        format TEXT NOT NULL CHECK (format IN ('pdf','docx')), page_count INTEGER,
        extracted_text TEXT NOT NULL, confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
        warnings TEXT NOT NULL, created_at INTEGER NOT NULL,
        FOREIGN KEY (plan_version_id) REFERENCES lesson_plan_versions(id) ON DELETE CASCADE
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS criterion_results (
        id TEXT PRIMARY KEY NOT NULL, analysis_run_id TEXT NOT NULL, code TEXT NOT NULL,
        stage TEXT NOT NULL, title TEXT NOT NULL, score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 3),
        status TEXT NOT NULL, rationale TEXT NOT NULL, evidence TEXT NOT NULL,
        suggestion TEXT NOT NULL, confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
        created_at INTEGER NOT NULL,
        FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
        UNIQUE(analysis_run_id, code)
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS file_retentions (
        id TEXT PRIMARY KEY NOT NULL, plan_version_id TEXT NOT NULL UNIQUE,
        file_key TEXT NOT NULL, delete_after INTEGER NOT NULL, deleted_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (plan_version_id) REFERENCES lesson_plan_versions(id) ON DELETE CASCADE
      )`),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_lesson_plans_owner_updated ON lesson_plans(owner_id, updated_at)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_lesson_plans_status ON lesson_plans(status)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_runs_plan_version ON analysis_runs(plan_version_id, created_at)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_criterion_results_analysis ON criterion_results(analysis_run_id)"),
      d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_document_extractions_plan_version ON document_extractions(plan_version_id)"),
      d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_file_retentions_plan_version ON file_retentions(plan_version_id)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_file_retentions_delete_after ON file_retentions(delete_after)"),
      d1.prepare(`INSERT OR IGNORE INTO file_retentions
        (id, plan_version_id, file_key, delete_after, deleted_at, created_at)
        SELECT lower(hex(randomblob(16))), id, source_file_key, created_at + ${FILE_RETENTION_MS}, NULL, created_at
        FROM lesson_plan_versions WHERE source_file_key IS NOT NULL`),
    ]);
  })().catch((error) => { initialization = null; throw error; });
  return initialization;
}

async function purgeExpiredLessonPlanFiles(): Promise<void> {
  const now = Date.now();
  if (now < nextRetentionSweepAt) return;
  nextRetentionSweepAt = now + 60 * 60 * 1000;
  const expired = await getD1().prepare(`SELECT id, plan_version_id AS planVersionId, file_key AS fileKey
    FROM file_retentions WHERE deleted_at IS NULL AND delete_after <= ? ORDER BY delete_after LIMIT 20`)
    .bind(now).all<{ id: string; planVersionId: string; fileKey: string }>();
  for (const item of expired.results) {
    await getR2().delete(item.fileKey);
    await getD1().batch([
      getD1().prepare("UPDATE file_retentions SET deleted_at = ? WHERE id = ?").bind(now, item.id),
      getD1().prepare(`UPDATE lesson_plan_versions SET source_file_key = NULL, source_file_name = NULL,
        source_mime_type = NULL, source_file_size = NULL WHERE id = ?`).bind(item.planVersionId),
    ]);
  }
}

export async function createLessonPlan(ownerId: string, input: CreateLessonPlanInput): Promise<{ id: string; analysis: MiapAnalysis }> {
  await initializeLessonPlanDatabase();
  await purgeExpiredLessonPlanFiles().catch(() => undefined);
  const planId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const analysisId = crypto.randomUUID();
  const now = Date.now();
  const fileExpiresAt = now + FILE_RETENTION_MS;
  const analysis = analyzeMiapPlan(input);
  let fileKey: string | null = null;

  if (input.attachment && input.attachment.size > 0) {
    fileKey = `lesson-plans/${ownerId}/${planId}/v1/${crypto.randomUUID()}`;
    await getR2().put(fileKey, await input.attachment.arrayBuffer(), {
      httpMetadata: { contentType: input.attachment.type || "application/octet-stream" },
      customMetadata: { originalName: input.attachment.name, ownerId, planId, deleteAfter: new Date(fileExpiresAt).toISOString() },
    });
  }

  try {
    const statements = [
      getD1().prepare(`INSERT INTO lesson_plans
        (id, owner_id, title, course, learner_level, duration_minutes, status, current_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'analyzed', 1, ?, ?)`)
        .bind(planId, ownerId, input.title, input.course, input.learnerLevel, input.durationMinutes, now, now),
      getD1().prepare(`INSERT INTO lesson_plan_versions
        (id, plan_id, version_number, objectives, motivation, information, application, progress,
         assessment, time_allocation, source_file_key, source_file_name, source_mime_type, source_file_size, created_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(versionId, planId, input.objectives, input.motivation, input.information, input.application,
          input.progress, input.assessment, input.timeAllocation, fileKey,
          input.attachment?.name ?? null, input.attachment?.type ?? null, input.attachment?.size ?? null, now),
      getD1().prepare(`INSERT INTO analysis_runs
        (id, plan_version_id, analyzer_type, rubric_version, structure_score, alignment_score, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(analysisId, versionId, analysis.analyzerType, analysis.rubricVersion,
          analysis.structureScore, analysis.alignmentScore, analysis.summary, now),
      ...(input.extraction ? [getD1().prepare(`INSERT INTO document_extractions
        (id, plan_version_id, format, page_count, extracted_text, confidence, warnings, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), versionId, input.extraction.format, input.extraction.pageCount,
          input.extraction.text, input.extraction.confidence, JSON.stringify(input.extraction.warnings), now)] : []),
      ...(fileKey ? [getD1().prepare(`INSERT INTO file_retentions
        (id, plan_version_id, file_key, delete_after, deleted_at, created_at)
        VALUES (?, ?, ?, ?, NULL, ?)`)
        .bind(crypto.randomUUID(), versionId, fileKey, fileExpiresAt, now)] : []),
      ...analysis.results.map((item) => getD1().prepare(`INSERT INTO criterion_results
        (id, analysis_run_id, code, stage, title, score, status, rationale, evidence, suggestion, confidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), analysisId, item.code, item.stage, item.title, item.score,
          item.status, item.rationale, item.evidence, item.suggestion, item.confidence, now)),
    ];
    await getD1().batch(statements);
  } catch (error) {
    if (fileKey) await getR2().delete(fileKey).catch(() => undefined);
    throw error;
  }

  return { id: planId, analysis };
}

export async function storeLessonPlanReference(ownerId: string, input: StoreLessonPlanReferenceInput): Promise<{ id: string }> {
  await initializeLessonPlanDatabase();
  await purgeExpiredLessonPlanFiles().catch(() => undefined);
  const planId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const retentionId = crypto.randomUUID();
  const now = Date.now();
  const fileExpiresAt = now + FILE_RETENTION_MS;
  const fileKey = `lesson-plans/${ownerId}/${planId}/v1/${crypto.randomUUID()}`;

  await getR2().put(fileKey, await input.attachment.arrayBuffer(), {
    httpMetadata: { contentType: input.attachment.type || "application/octet-stream" },
    customMetadata: {
      originalName: input.attachment.name,
      ownerId,
      planId,
      purpose: "practice-comparison-reference",
      deleteAfter: new Date(fileExpiresAt).toISOString(),
    },
  });

  try {
    await getD1().batch([
      getD1().prepare(`INSERT INTO lesson_plans
        (id, owner_id, title, course, learner_level, duration_minutes, status, current_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ไม่ระบุ', 0, 'draft', 1, ?, ?)`).bind(planId, ownerId, input.title, input.course, now, now),
      getD1().prepare(`INSERT INTO lesson_plan_versions
        (id, plan_id, version_number, objectives, motivation, information, application, progress,
         assessment, time_allocation, source_file_key, source_file_name, source_mime_type, source_file_size, created_at)
        VALUES (?, ?, 1, '', '', '', '', '', '', '', ?, ?, ?, ?, ?)`).bind(
          versionId, planId, fileKey, input.attachment.name, input.attachment.type || "application/octet-stream", input.attachment.size, now,
        ),
      getD1().prepare(`INSERT INTO file_retentions
        (id, plan_version_id, file_key, delete_after, deleted_at, created_at)
        VALUES (?, ?, ?, ?, NULL, ?)`).bind(retentionId, versionId, fileKey, fileExpiresAt, now),
    ]);
  } catch (error) {
    await getR2().delete(fileKey).catch(() => undefined);
    throw error;
  }

  return { id: planId };
}

export async function listLessonPlans(ownerId: string): Promise<LessonPlanSummary[]> {
  await initializeLessonPlanDatabase();
  await purgeExpiredLessonPlanFiles().catch(() => undefined);
  const result = await getD1().prepare(`SELECT lp.id, lp.title, lp.course, lp.learner_level AS learnerLevel,
      lp.duration_minutes AS durationMinutes, lp.status, lp.current_version AS currentVersion,
      lp.updated_at AS updatedAt, 0 AS structureScore, 0 AS alignmentScore
    FROM lesson_plans lp
    WHERE lp.owner_id = ? AND lp.status = 'draft'
    ORDER BY lp.updated_at DESC`).bind(ownerId).all<LessonPlanSummary>();
  return result.results;
}

export async function getLessonPlanDetail(planId: string, ownerId: string): Promise<LessonPlanDetail | null> {
  await initializeLessonPlanDatabase();
  await purgeExpiredLessonPlanFiles().catch(() => undefined);
  const detail = await getD1().prepare(`SELECT lp.id, lp.title, lp.course, lp.learner_level AS learnerLevel,
      lp.duration_minutes AS durationMinutes, lp.status, lp.current_version AS currentVersion,
      lp.updated_at AS updatedAt, lpv.objectives, lpv.motivation, lpv.information,
      lpv.application, lpv.progress, lpv.assessment, lpv.time_allocation AS timeAllocation,
      lpv.source_file_name AS sourceFileName, ar.id AS analysisId, ar.analyzer_type AS analyzerType,
      ar.rubric_version AS rubricVersion, ar.structure_score AS structureScore,
      ar.alignment_score AS alignmentScore, ar.summary AS analysisSummary,
      de.format AS extractionFormat, de.page_count AS extractionPageCount,
      de.confidence AS extractionConfidence, de.warnings AS extractionWarningsJson,
      substr(de.extracted_text, 1, 1200) AS extractedTextPreview,
      CASE WHEN fr.deleted_at IS NULL THEN fr.delete_after ELSE NULL END AS sourceFileExpiresAt
    FROM lesson_plans lp
    INNER JOIN lesson_plan_versions lpv ON lpv.plan_id = lp.id AND lpv.version_number = lp.current_version
    INNER JOIN analysis_runs ar ON ar.plan_version_id = lpv.id
    LEFT JOIN document_extractions de ON de.plan_version_id = lpv.id
    LEFT JOIN file_retentions fr ON fr.plan_version_id = lpv.id
    WHERE lp.id = ? AND lp.owner_id = ? ORDER BY ar.created_at DESC LIMIT 1`)
    .bind(planId, ownerId).first<Omit<LessonPlanDetail, "results" | "extractionWarnings"> & { analysisId: string; extractionWarningsJson: string | null }>();
  if (!detail) return null;
  const result = await getD1().prepare(`SELECT code, stage, title, score, status, rationale, evidence, suggestion, confidence
    FROM criterion_results WHERE analysis_run_id = ?
    ORDER BY CASE stage WHEN 'M' THEN 1 WHEN 'I' THEN 2 WHEN 'A' THEN 3 WHEN 'P' THEN 4 ELSE 5 END, code`)
    .bind(detail.analysisId).all<LessonPlanDetail["results"][number]>();
  const { analysisId, extractionWarningsJson, ...plan } = detail;
  void analysisId;
  let extractionWarnings: string[] = [];
  try { extractionWarnings = extractionWarningsJson ? JSON.parse(extractionWarningsJson) : []; } catch { extractionWarnings = []; }
  return { ...plan, extractionWarnings, results: result.results };
}
