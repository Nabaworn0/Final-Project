import type { MiapPlanInput } from "./miap-analysis";
import type { EstimatedMiapTime } from "./document-extraction";

export type StructuredDocumentPlan = MiapPlanInput & {
  title: string;
  course: string;
  learnerLevel: string;
  mappingConfidence: "low" | "medium" | "high";
  mappingWarnings: string[];
};

type Section = "objectives" | "motivation" | "information" | "application" | "progress" | "assessment" | "timeAllocation";

const HEADINGS: Record<Section, RegExp> = {
  objectives: /^(?:\d+[.)]?\s*)?(?:วัตถุประสงค์|จุดประสงค์|ผลลัพธ์การเรียนรู้)/i,
  motivation: /^(?:\d+[.)]?\s*)?(?:m\s*[:.)-]?\s*)?(?:motivation|ขั้นนำ|นำเข้าสู่บทเรียน|สร้างแรงจูงใจ)/i,
  information: /^(?:\d+[.)]?\s*)?(?:i\s*[:.)-]?\s*)?(?:information|ขั้นสอน|สาระการเรียนรู้|เนื้อหา)/i,
  application: /^(?:\d+[.)]?\s*)?(?:a\s*[:.)-]?\s*)?(?:application|ขั้นปฏิบัติ|ฝึกปฏิบัติ|กิจกรรมผู้เรียน)/i,
  progress: /^(?:\d+[.)]?\s*)?(?:p\s*[:.)-]?\s*)?(?:progress|ขั้นสรุป|ตรวจสอบความก้าวหน้า|สะท้อนผล)/i,
  assessment: /^(?:\d+[.)]?\s*)?(?:การวัดและประเมินผล|การประเมินผล|เครื่องมือประเมิน|เกณฑ์การประเมิน)/i,
  timeAllocation: /^(?:\d+[.)]?\s*)?(?:เวลา|ระยะเวลา|การจัดสรรเวลา)/i,
};

const SIGNALS: Record<Section, string[]> = {
  objectives: ["สามารถ", "วัตถุประสงค์", "จุดประสงค์", "ผลลัพธ์การเรียนรู้"],
  motivation: ["กระตุ้น", "แรงจูงใจ", "คำถาม", "ความรู้เดิม", "นำเข้าสู่"],
  information: ["อธิบาย", "สาธิต", "เนื้อหา", "หลักการ", "ขั้นตอน"],
  application: ["ปฏิบัติ", "ฝึก", "ลงมือ", "ชิ้นงาน", "กิจกรรมผู้เรียน"],
  progress: ["ตรวจสอบ", "ความก้าวหน้า", "สะท้อน", "ข้อมูลย้อนกลับ", "สรุป"],
  assessment: ["ประเมิน", "เกณฑ์", "รูบริก", "แบบทดสอบ", "คะแนน"],
  timeAllocation: ["นาที", "ชั่วโมง", "เวลา", "ระยะเวลา"],
};

function cleanHeading(line: string, section: Section): string {
  return line.replace(HEADINGS[section], "").replace(/^\s*[:：.\-)]+\s*/, "").trim();
}

function bestParagraph(paragraphs: string[], section: Section): string {
  const best = paragraphs
    .map((paragraph) => ({ paragraph, score: SIGNALS[section].filter((signal) => paragraph.includes(signal)).length }))
    .sort((a, b) => b.score - a.score || b.paragraph.length - a.paragraph.length)[0];
  return best?.score > 0 ? best.paragraph : "";
}

function findMetadata(lines: string[], labels: string[]): string | null {
  for (const line of lines.slice(0, 80)) {
    const match = line.match(new RegExp(`(?:${labels.join("|")})\\s*[:：]?\\s*(.{2,160})$`, "i"));
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function tableStage(value: string): "motivation" | "information" | "application" | "progress" | null {
  const compact = value.replace(/\s+/g, " ").trim();
  if (/^(?:M|Motivation)$/i.test(compact) || /ขั้นสนใจปัญหา|สร้างแรงจูงใจ|ขั้นนำ/.test(compact)) return "motivation";
  if (/^(?:I|Information)$/i.test(compact) || /ขั้นบอกกล่าว|ให้ข้อมูล|ขั้นสอน/.test(compact)) return "information";
  if (/^(?:A|Application)$/i.test(compact) || /ขั้นพยายาม|ขั้นปฏิบัติ|ประยุกต์/.test(compact)) return "application";
  if (/^(?:P|Progress)$/i.test(compact) || /ขั้นสำเร็จผล|ตรวจสอบความก้าวหน้า|ขั้นสรุป/.test(compact)) return "progress";
  return null;
}

function tableMiapData(tables: string[][], estimatedMiapTime: EstimatedMiapTime | null): {
  buckets: Partial<Record<Section, string[]>>;
  detectedStages: number;
  totalMinutes: number | null;
} {
  const buckets: Partial<Record<Section, string[]>> = {};
  const stages = new Set<Section>();
  const timeEntries = new Map<Section, number>();
  let totalMinutes: number | null = null;

  for (let rowIndex = 0; rowIndex < tables.length; rowIndex += 1) {
    const row = tables[rowIndex];
    const first = row[0] ?? "";
    if (/เวลา\s*\(?(?:นาที)?\)?/i.test(first)) {
      const values = row.slice(1).map((cell) => Number(cell.trim())).filter((value) => Number.isFinite(value) && value > 0 && value <= 600);
      if (values.length >= 4) totalMinutes = Math.max(totalMinutes ?? 0, ...values);
    }

    const headerStageIndex = row.findIndex((cell) => /ขั้นการสอน|ขั้นตอนการสอน|ขั้น MIAP/i.test(cell));
    const headerActivityIndex = row.findIndex((cell) => /^(?:กิจกรรม|กิจกรรมการเรียนรู้|กิจกรรมครูและผู้เรียน)$/i.test(cell.trim()));
    if (headerStageIndex < 0 || headerActivityIndex < 0) continue;
    const headerTimeIndex = row.findIndex((cell) => /เวลา/.test(cell));
    let activeStage: Section | null = null;

    for (let dataIndex = rowIndex + 1; dataIndex < tables.length; dataIndex += 1) {
      const dataRow = tables[dataIndex];
      if (dataRow.length === 0) break;
      if (dataRow.some((cell) => /ขั้นการสอน|ขั้นตอนการสอน/.test(cell))) break;
      const foundStage = tableStage(dataRow[headerStageIndex] ?? "");
      if (foundStage) activeStage = foundStage;
      if (!activeStage) continue;
      const activity = (dataRow[headerActivityIndex] ?? "").trim();
      if (activity.length >= 8) {
        (buckets[activeStage] ??= []).push(activity);
        stages.add(activeStage);
        if (activeStage === "progress" && signalCount(activity, SIGNALS.assessment) > 0) {
          (buckets.assessment ??= []).push(activity);
        }
      }
      if (headerTimeIndex >= 0) {
        const match = (dataRow[headerTimeIndex] ?? "").match(/(\d+(?:\.\d+)?)\s*(?:นาที)?/);
        if (match) timeEntries.set(activeStage, (timeEntries.get(activeStage) ?? 0) + Number(match[1]));
      }
      if (foundStage && !activity && dataIndex > rowIndex + 8) break;
    }
  }

  if (estimatedMiapTime) {
    buckets.timeAllocation = [`เวลาที่ระบบประมาณ: M ${estimatedMiapTime.motivation} นาที, I ${estimatedMiapTime.information} นาที, A ${estimatedMiapTime.application} นาที, P ${estimatedMiapTime.progress} นาที (รวม ${estimatedMiapTime.totalMinutes} นาที)`];
    totalMinutes = estimatedMiapTime.totalMinutes;
  } else if (timeEntries.size > 0) {
    buckets.timeAllocation = [...timeEntries].map(([stage, minutes]) => `${stage === "motivation" ? "M" : stage === "information" ? "I" : stage === "application" ? "A" : "P"} ${minutes} นาที`);
  } else if (totalMinutes) {
    buckets.timeAllocation = [`ระยะเวลารวมจากตาราง ${totalMinutes} นาที (ไม่พบเวลาแยก M–I–A–P)`];
  }
  return { buckets, detectedStages: stages.size, totalMinutes };
}

function signalCount(value: string, signals: readonly string[]): number {
  return signals.filter((signal) => value.includes(signal)).length;
}

export function structureDocumentAsMiap(text: string, fileName: string, tables: string[][] = [], estimatedMiapTime: EstimatedMiapTime | null = null): StructuredDocumentPlan {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.length >= 20);
  const buckets: Record<Section, string[]> = {
    objectives: [], motivation: [], information: [], application: [], progress: [], assessment: [], timeAllocation: [],
  };
  let active: Section | null = null;
  let detectedHeadings = 0;

  for (const line of lines) {
    const found = (Object.keys(HEADINGS) as Section[]).find((section) => HEADINGS[section].test(line));
    if (found) {
      active = found;
      detectedHeadings += 1;
      const remainder = cleanHeading(line, found);
      if (remainder) buckets[found].push(remainder);
    } else if (active) {
      buckets[active].push(line);
    }
  }

  const tableData = tableMiapData(tables, estimatedMiapTime);
  for (const section of Object.keys(tableData.buckets) as Section[]) {
    const values = tableData.buckets[section];
    if (values?.join(" ").length && section !== "timeAllocation") buckets[section] = values;
    if (values?.join(" ").length && section === "timeAllocation") buckets.timeAllocation = values;
  }
  detectedHeadings += tableData.detectedStages;

  for (const section of Object.keys(buckets) as Section[]) {
    if (buckets[section].join(" ").length < 20) buckets[section] = [bestParagraph(paragraphs, section)];
  }

  const durationMatch = text.match(/(?:ระยะเวลา|เวลา(?:ที่ใช้)?)[^\d]{0,20}(\d{1,3})\s*(นาที|ชั่วโมง)/i);
  const durationMinutes = durationMatch
    ? Number(durationMatch[1]) * (durationMatch[2] === "ชั่วโมง" ? 60 : 1)
    : tableData.totalMinutes ?? 60;
  const title = findMetadata(lines, ["ชื่อแผนการสอน", "ชื่อเรื่อง", "หน่วยการเรียนรู้", "เรื่อง"])
    ?? lines.find((line) => line.length >= 4 && line.length <= 160)
    ?? fileName.replace(/\.(pdf|docx)$/i, "");
  const missing = (Object.keys(buckets) as Section[]).filter((section) => buckets[section].join(" ").length < 20);
  const sectionNames: Record<Section, string> = {
    objectives: "วัตถุประสงค์", motivation: "Motivation", information: "Information",
    application: "Application", progress: "Progress", assessment: "การประเมินผล", timeAllocation: "การจัดสรรเวลา",
  };
  const mappingWarnings = missing.length
    ? [`ไม่พบหัวข้อชัดเจน: ${missing.map((section) => sectionNames[section]).join(", ")} กรุณาตรวจข้อมูลที่ระบบจับคู่ก่อนนำผลไปใช้`]
    : [];
  if (!durationMatch && !tableData.totalMinutes) mappingWarnings.push("ไม่พบระยะเวลารวมที่ชัดเจน ระบบใช้ค่าเริ่มต้น 60 นาที");
  if (tableData.totalMinutes && !estimatedMiapTime && !(tableData.buckets.timeAllocation?.join(" ").match(/\bM\s*\d+[\s\S]*\bI\s*\d+[\s\S]*\bA\s*\d+[\s\S]*\bP\s*\d+/i))) {
    mappingWarnings.push(`พบแผนภูมิเวลารวม ${tableData.totalMinutes} นาที แต่ไม่พบตัวเลขเวลาแยกครบทุกขั้น M–I–A–P`);
  }

  const fallback = "ไม่พบหลักฐานที่ชัดเจนในเอกสารต้นฉบับ";
  return {
    title: title.slice(0, 160),
    course: findMetadata(lines, ["รายวิชา", "วิชา"]) ?? "ไม่ระบุรายวิชาในเอกสาร",
    learnerLevel: findMetadata(lines, ["ระดับชั้น", "ระดับผู้เรียน", "ชั้นปี"]) ?? "ไม่ระบุระดับผู้เรียนในเอกสาร",
    durationMinutes: Math.min(600, Math.max(15, durationMinutes)),
    objectives: buckets.objectives.join("\n").slice(0, 4000) || fallback,
    motivation: buckets.motivation.join("\n").slice(0, 6000) || fallback,
    information: buckets.information.join("\n").slice(0, 6000) || fallback,
    application: buckets.application.join("\n").slice(0, 6000) || fallback,
    progress: buckets.progress.join("\n").slice(0, 6000) || fallback,
    assessment: buckets.assessment.join("\n").slice(0, 4000) || fallback,
    timeAllocation: buckets.timeAllocation.join("\n").slice(0, 1000) || `ระยะเวลารวม ${durationMinutes} นาที`,
    mappingConfidence: detectedHeadings >= 5 ? "high" : detectedHeadings >= 3 ? "medium" : "low",
    mappingWarnings,
  };
}
