export type MiapCriterionResult = {
  code: string;
  stage: "M" | "I" | "A" | "P" | "ALIGNMENT";
  title: string;
  score: number;
  status: string;
  rationale: string;
  evidence: string;
  suggestion: string;
  confidence: "low" | "medium" | "high";
};

export type MiapPlanInput = {
  objectives: string;
  motivation: string;
  information: string;
  application: string;
  progress: string;
  assessment: string;
  timeAllocation: string;
  durationMinutes: number;
};

export type MiapAnalysis = {
  analyzerType: "rule_v1";
  rubricVersion: "miap-v2";
  structureScore: number;
  alignmentScore: number;
  summary: string;
  results: MiapCriterionResult[];
};

const SIGNALS = {
  motivation: ["คำถาม", "สถานการณ์", "ปัญหา", "วิดีโอ", "เกม", "กรณีศึกษา", "กระตุ้น", "ท้าทาย"],
  priorKnowledge: ["ความรู้เดิม", "ประสบการณ์เดิม", "ทบทวน", "เชื่อมโยง", "เคย", "ก่อนเรียน"],
  information: ["อธิบาย", "สาธิต", "ตัวอย่าง", "ขั้นตอน", "เนื้อหา", "แนวคิด", "หลักการ"],
  practice: ["ลงมือ", "ปฏิบัติ", "ทดลอง", "ฝึก", "เขียน", "สร้าง", "แก้ปัญหา", "ชิ้นงาน"],
  assessment: ["ประเมิน", "ตรวจ", "แบบทดสอบ", "รูบริก", "เกณฑ์", "ชิ้นงาน", "สังเกต", "สะท้อนผล"],
  observableVerb: ["อธิบาย", "บอก", "จำแนก", "เปรียบเทียบ", "สาธิต", "ปฏิบัติ", "สร้าง", "เขียน", "แก้", "คำนวณ", "เลือก", "ประเมิน", "วิเคราะห์", "ออกแบบ", "ติดตั้ง", "ตรวจสอบ", "พิมพ์"],
  successCriterion: ["ร้อยละ", "เปอร์เซ็นต์", "%", "ภายใน", "อย่างน้อย", "ไม่เกิน", "ถูกต้อง", "เกณฑ์", "คะแนน"],
} as const;

const STOP_WORDS = new Set(["และ", "หรือ", "ของ", "ใน", "ที่", "ให้", "ได้", "เป็น", "การ", "โดย", "จาก", "กับ", "เพื่อ", "ผู้เรียน", "นักเรียน", "ครู", "อาจารย์"]);

function compact(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function excerpt(value: string, signals: readonly string[] = []): string {
  const segments = value.split(/(?:\n+|(?<=[.!?。])\s+)/).map(compact).filter(Boolean);
  const ranked = segments.map((segment) => ({
    segment,
    score: signals.filter((signal) => segment.toLowerCase().includes(signal.toLowerCase())).length,
  })).sort((a, b) => b.score - a.score || b.segment.length - a.segment.length);
  const selected = compact(ranked[0]?.segment ?? value);
  return selected.length > 240 ? `${selected.slice(0, 237)}…` : selected;
}

function signalCount(value: string, signals: readonly string[]): number {
  const normalized = value.toLowerCase();
  return signals.filter((signal) => normalized.includes(signal.toLowerCase())).length;
}

function keywords(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}%]+/u)
    .map((word) => word.trim()).filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)));
}

function sharedKeywordCount(left: string, right: string): number {
  const leftWords = keywords(left);
  const rightWords = keywords(right);
  return [...leftWords].filter((word) => rightWords.has(word)).length;
}

function contentScore(value: string, signals: readonly string[]): number {
  const length = compact(value).length;
  if (length < 20) return 0;
  const matches = signalCount(value, signals);
  if (matches >= 2 && length >= 100) return 3;
  if (matches >= 1 && length >= 45) return 2;
  return 1;
}

function objectiveQualityScore(value: string): number {
  const length = compact(value).length;
  if (length < 20) return 0;
  const verbs = signalCount(value, SIGNALS.observableVerb);
  const criteria = signalCount(value, SIGNALS.successCriterion);
  if (verbs >= 2 && criteria >= 1) return 3;
  if (verbs >= 1) return 2;
  return 1;
}

function alignmentScore(left: string, right: string, signals: readonly string[]): number {
  if (compact(left).length < 20 || compact(right).length < 20) return 0;
  const matches = signalCount(right, signals);
  const overlap = sharedKeywordCount(left, right);
  if (matches >= 2 && overlap >= 1) return 3;
  if (matches >= 1 || overlap >= 1) return 2;
  return 1;
}

function assessmentAlignmentScore(objectives: string, assessment: string): number {
  const base = alignmentScore(objectives, assessment, SIGNALS.assessment);
  if (base === 0) return 0;
  const hasCriterion = signalCount(assessment, SIGNALS.successCriterion) > 0;
  if (base >= 2 && hasCriterion) return 3;
  return base;
}

function timeScore(value: string, durationMinutes: number): number {
  if (compact(value).length < 12) return 0;
  const stagePatterns = [
    /(?:\bM\b|Motivation|ขั้นนำ|สร้างแรงจูงใจ)[^\d]{0,35}(\d+(?:\.\d+)?)\s*นาที/i,
    /(?:\bI\b|Information|ขั้นสอน|ให้ข้อมูล)[^\d]{0,35}(\d+(?:\.\d+)?)\s*นาที/i,
    /(?:\bA\b|Application|ขั้นปฏิบัติ|ประยุกต์)[^\d]{0,35}(\d+(?:\.\d+)?)\s*นาที/i,
    /(?:\bP\b|Progress|ขั้นสรุป|ตรวจสอบความก้าวหน้า)[^\d]{0,35}(\d+(?:\.\d+)?)\s*นาที/i,
  ];
  const staged = stagePatterns.map((pattern) => value.match(pattern)?.[1]).filter((item): item is string => Boolean(item)).map(Number);
  if (staged.length < 4) return staged.length >= 2 ? 1 : 1;
  const total = staged.reduce((sum, item) => sum + item, 0);
  const difference = Math.abs(total - durationMinutes);
  if (difference === 0) return /เวลาที่ระบบประมาณ/.test(value) ? 2 : 3;
  return difference <= Math.max(5, durationMinutes * 0.1) ? 2 : 1;
}

function statusFor(score: number): string {
  return ["ไม่พบหลักฐาน", "ควรปรับปรุง", "ผ่านเกณฑ์เบื้องต้น", "มีหลักฐานชัดเจน"][score] ?? "ควรตรวจสอบ";
}

function result(
  code: string,
  stage: MiapCriterionResult["stage"],
  title: string,
  score: number,
  rationale: string,
  evidence: string,
  suggestion: string,
  signals: readonly string[] = [],
  confidence: MiapCriterionResult["confidence"] = "medium",
): MiapCriterionResult {
  return { code, stage, title, score, status: statusFor(score), rationale, evidence: excerpt(evidence, signals), suggestion, confidence };
}

export function analyzeMiapPlan(input: MiapPlanInput): MiapAnalysis {
  const m1 = contentScore(input.motivation, SIGNALS.motivation);
  const m2 = contentScore(input.motivation, SIGNALS.priorKnowledge);
  const i1 = alignmentScore(input.objectives, input.information, SIGNALS.information);
  const i2 = contentScore(input.information, SIGNALS.information);
  const a1 = contentScore(input.application, SIGNALS.practice);
  const a2 = alignmentScore(input.objectives, input.application, SIGNALS.practice);
  const p1 = contentScore(`${input.progress} ${input.assessment}`, SIGNALS.assessment);
  const p2 = assessmentAlignmentScore(input.objectives, input.assessment);
  const oq = objectiveQualityScore(input.objectives);
  const oa = alignmentScore(input.objectives, input.application, SIGNALS.practice);
  const op = assessmentAlignmentScore(input.objectives, input.assessment);
  const at = timeScore(input.timeAllocation, input.durationMinutes);
  const usesEstimatedTime = /เวลาที่ระบบประมาณ/.test(input.timeAllocation);

  const results = [
    result("M1", "M", "การสร้างแรงจูงใจ", m1, "ตรวจหากิจกรรมที่กระตุ้นความสนใจหรือสร้างปัญหาให้ผู้เรียนอยากเรียนรู้", input.motivation, "เพิ่มคำถาม สถานการณ์ หรือโจทย์ที่เชื่อมกับเนื้อหาและระบุสิ่งที่ผู้เรียนต้องตอบ", SIGNALS.motivation),
    result("M2", "M", "การเชื่อมโยงความรู้เดิม", m2, "ตรวจการทบทวนหรือเชื่อมประสบการณ์เดิมกับบทเรียนใหม่", input.motivation, "ระบุคำถามหรือกิจกรรมสั้น ๆ สำหรับเรียกคืนความรู้เดิมก่อนเข้าสู่เนื้อหาใหม่", SIGNALS.priorKnowledge),
    result("I1", "I", "เนื้อหาสอดคล้องกับวัตถุประสงค์", i1, "ตรวจทั้งคำสำคัญร่วมและวิธีนำเสนอที่สนับสนุนวัตถุประสงค์", input.information, "จับคู่วัตถุประสงค์แต่ละข้อกับหัวข้อเนื้อหาและตัวอย่างที่เกี่ยวข้องโดยตรง", [...SIGNALS.information, ...keywords(input.objectives)]),
    result("I2", "I", "ลำดับการนำเสนอเนื้อหา", i2, "ตรวจความชัดเจนของคำอธิบาย ตัวอย่าง การสาธิต และขั้นตอนการสอน", input.information, "จัดลำดับจากพื้นฐานไปสู่การประยุกต์ พร้อมตัวอย่างหรือการสาธิตระหว่างทาง", SIGNALS.information),
    result("A1", "A", "ผู้เรียนได้ลงมือปฏิบัติ", a1, "ตรวจหากิจกรรมที่ผู้เรียนต้องฝึก ทดลอง สร้าง หรือแก้ปัญหาด้วยตนเอง", input.application, "เพิ่มภาระงานที่ผู้เรียนลงมือทำ พร้อมระบุผลผลิตหรือชิ้นงานที่ตรวจสอบได้", SIGNALS.practice),
    result("A2", "A", "กิจกรรมสอดคล้องกับทักษะเป้าหมาย", a2, "ตรวจคำสำคัญร่วมระหว่างวัตถุประสงค์กับกิจกรรมของผู้เรียน", input.application, "กำหนดกิจกรรมอย่างน้อยหนึ่งรายการต่อวัตถุประสงค์สำคัญและใช้คำกริยาเดียวกัน", [...SIGNALS.practice, ...keywords(input.objectives)]),
    result("P1", "P", "การตรวจสอบความก้าวหน้า", p1, "ตรวจว่ามีวิธีประเมินระหว่างหรือหลังเรียนและมีหลักฐานที่ตรวจได้", `${input.progress}\n${input.assessment}`, "เพิ่มวิธีตรวจความเข้าใจ ผลงาน หรือพฤติกรรมที่สังเกตได้ พร้อมช่วงเวลาที่ให้ข้อมูลย้อนกลับ", SIGNALS.assessment),
    result("P2", "P", "การประเมินสอดคล้องกับวัตถุประสงค์", p2, "ตรวจเครื่องมือ เกณฑ์ผ่าน และคำสำคัญที่เชื่อมกับพฤติกรรมตามวัตถุประสงค์", input.assessment, "ระบุเครื่องมือ หลักฐาน และเกณฑ์ผ่านของวัตถุประสงค์แต่ละข้อให้ครบ", [...SIGNALS.assessment, ...SIGNALS.successCriterion]),
    result("OQ", "ALIGNMENT", "คุณภาพของวัตถุประสงค์", oq, "ตรวจคำกริยาที่สังเกตหรือวัดได้และเกณฑ์ความสำเร็จ", input.objectives, "เขียนวัตถุประสงค์ด้วยพฤติกรรมที่สังเกตได้ และเพิ่มระดับหรือเกณฑ์ผ่านที่ชัดเจน", [...SIGNALS.observableVerb, ...SIGNALS.successCriterion]),
    result("OA", "ALIGNMENT", "Objective ↔ MIAP Activity", oa, "ตรวจความสัมพันธ์ระหว่างวัตถุประสงค์กับกิจกรรมที่ผู้เรียนปฏิบัติ", input.application, "ใช้คำกริยาและผลงานเป้าหมายเดียวกับวัตถุประสงค์ในคำอธิบายกิจกรรม", [...SIGNALS.practice, ...keywords(input.objectives)]),
    result("OP", "ALIGNMENT", "Objective ↔ Assessment", op, "ตรวจความสัมพันธ์ระหว่างวัตถุประสงค์ เครื่องมือ และเกณฑ์ประเมิน", input.assessment, "กำหนดเครื่องมือ หลักฐาน และเกณฑ์ประเมินแยกตามวัตถุประสงค์", [...SIGNALS.assessment, ...SIGNALS.successCriterion]),
    result("AT", "ALIGNMENT", "MIAP Activity ↔ Time Allocation", at, "ตรวจเวลาแยก M–I–A–P และเปรียบเทียบผลรวมกับเวลาสอน", input.timeAllocation, usesEstimatedTime ? "ตรวจค่าประมาณกับแผนภูมิต้นฉบับ และระบุตัวเลขเวลาในเอกสารหากต้องการผลที่มีความมั่นใจสูง" : `ระบุเวลา M, I, A และ P เป็นนาทีให้ครบและรวมได้ ${input.durationMinutes} นาที`, ["นาที", "Motivation", "Information", "Application", "Progress"], usesEstimatedTime ? "medium" : "high"),
  ];

  const structureResults = results.filter((item) => item.stage !== "ALIGNMENT");
  const alignmentResults = results.filter((item) => item.stage === "ALIGNMENT");
  const structureScore = Math.round(structureResults.reduce((sum, item) => sum + item.score, 0) / (structureResults.length * 3) * 100);
  const alignmentScoreValue = Math.round(alignmentResults.reduce((sum, item) => sum + item.score, 0) / (alignmentResults.length * 3) * 100);
  const urgentCount = results.filter((item) => item.score <= 1).length;
  const summary = urgentCount === 0 && structureScore >= 75 && alignmentScoreValue >= 75
    ? "โครงสร้าง MIAP และความสอดคล้องมีความพร้อมในระดับเบื้องต้น ควรให้อาจารย์ตรวจความเหมาะสมก่อนนำไปใช้จริง"
    : `พบ ${urgentCount} ประเด็นเร่งด่วนที่ควรปรับก่อนส่งแผน ให้เริ่มจากรายการคะแนน 0–1 ตามลำดับ`;

  return { analyzerType: "rule_v1", rubricVersion: "miap-v2", structureScore, alignmentScore: alignmentScoreValue, summary, results };
}
