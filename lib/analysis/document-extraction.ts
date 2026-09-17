import mammoth from "mammoth/mammoth.browser.js";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

export type EstimatedMiapTime = {
  motivation: number;
  information: number;
  application: number;
  progress: number;
  totalMinutes: number;
  confidence: "medium";
  basis: "colored-merged-cells";
};

export type DocumentExtraction = {
  format: "pdf" | "docx";
  text: string;
  pageCount: number | null;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  tables: string[][];
  estimatedMiapTime: EstimatedMiapTime | null;
};

export class DocumentExtractionError extends Error {
  readonly code: "no-text" | "unreadable";

  constructor(code: "no-text" | "unreadable") {
    super(code);
    this.code = code;
  }
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function htmlCellText(value: string): string {
  return decodeHtml(value
    .replace(/<img\b[^>]*>/gi, " [ภาพ] ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 4000);
}

export function extractDocxTables(html: string): string[][] {
  const rows: string[][] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableStart = rows.length;
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => htmlCellText(cell[1]));
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length > tableStart) rows.push([]);
  }
  return rows.slice(0, 500);
}

function tableText(rows: string[][]): string {
  return rows.map((cells, index) => `[ตาราง แถว ${index + 1}] ${cells.map((cell) => cell.replace(/\n+/g, " ")).join(" | ")}`)
    .filter((line, index) => rows[index].length > 0 && line.length <= 5000)
    .join("\n");
}

type WordCell = { text: string; span: number; fill: string };

function wordTableRows(tableXml: string): WordCell[][] {
  return [...tableXml.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map((cell) => ({
      text: decodeHtml([...cell[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((part) => part[1]).join(" ")).replace(/\s+/g, " ").trim(),
      span: Math.max(1, Number(cell[0].match(/<w:gridSpan[^>]*w:val="(\d+)"/)?.[1] ?? "1")),
      fill: cell[0].match(/<w:shd[^>]*w:fill="([^"]+)"/)?.[1]?.toUpperCase() ?? "",
    })),
  );
}

function roundedStageTimes(spans: Record<"motivation" | "information" | "application" | "progress", number>, totalMinutes: number) {
  const keys = Object.keys(spans) as Array<keyof typeof spans>;
  const totalSpan = keys.reduce((sum, key) => sum + spans[key], 0);
  const times = Object.fromEntries(keys.map((key) => [key, Math.max(1, Math.round(spans[key] / totalSpan * totalMinutes))])) as Record<keyof typeof spans, number>;
  const difference = totalMinutes - keys.reduce((sum, key) => sum + times[key], 0);
  const largest = [...keys].sort((left, right) => spans[right] - spans[left])[0];
  times[largest] += difference;
  return times;
}

export async function extractDocxTimelineEstimate(buffer: ArrayBuffer): Promise<EstimatedMiapTime | null> {
  const archive = await JSZip.loadAsync(buffer);
  const documentXml = await archive.file("word/document.xml")?.async("string");
  if (!documentXml) return null;

  for (const table of documentXml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)) {
    const rows = wordTableRows(table[0]);
    const timeHeaderIndex = rows.findIndex((row) => /เวลา\s*\(?(?:นาที)?\)?/i.test(row[0]?.text ?? "")
      && row.slice(1).filter((cell) => /^\d+(?:\.\d+)?$/.test(cell.text)).length >= 4);
    if (timeHeaderIndex < 0) continue;
    const timeValues = rows[timeHeaderIndex].slice(1).map((cell) => Number(cell.text)).filter((value) => Number.isFinite(value) && value > 0);
    const totalMinutes = Math.max(...timeValues);
    const phaseRow = rows.slice(timeHeaderIndex + 1, timeHeaderIndex + 4).find((row) => {
      const labels = row.map((cell) => cell.text.trim());
      return labels.some((label) => /^M$/i.test(label)) && labels.some((label) => /^A$/i.test(label)) && labels.some((label) => /^P$/i.test(label));
    });
    if (!phaseRow || !Number.isFinite(totalMinutes) || totalMinutes <= 0) continue;

    const spans = { motivation: 0, information: 0, application: 0, progress: 0 };
    let active: keyof typeof spans | null = null;
    let coloredSegments = 0;
    for (const cell of phaseRow.slice(1)) {
      const label = cell.text.trim();
      if (/^M$/i.test(label)) active = "motivation";
      else if (/^I$/i.test(label)) active = "information";
      else if (/^A$/i.test(label)) active = "application";
      else if (/^P$/i.test(label) || /สรุป/.test(label)) active = "progress";
      else if (/^\d+$/.test(label) && spans.motivation > 0 && spans.application === 0) active = "information";
      if (!active) continue;
      spans[active] += cell.span;
      if (cell.fill && !["AUTO", "FFFFFF", "000000"].includes(cell.fill)) coloredSegments += 1;
    }
    if (Object.values(spans).some((span) => span <= 0) || coloredSegments < 3) continue;
    const times = roundedStageTimes(spans, totalMinutes);
    return { ...times, totalMinutes, confidence: "medium", basis: "colored-merged-cells" };
  }
  return null;
}

export async function extractDocument(file: File): Promise<DocumentExtraction> {
  try {
    const buffer = await file.arrayBuffer();
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    let text = "";
    let pageCount: number | null = null;
    let tables: string[][] = [];
    let estimatedMiapTime: EstimatedMiapTime | null = null;
    const warnings: string[] = [];

    if (isPdf) {
      const document = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(document, { mergePages: true });
      text = result.text;
      pageCount = result.totalPages;
    } else {
      const [rawResult, htmlResult, timelineEstimate] = await Promise.all([
        mammoth.extractRawText({ arrayBuffer: buffer }),
        mammoth.convertToHtml({ arrayBuffer: buffer }),
        extractDocxTimelineEstimate(buffer),
      ]);
      tables = extractDocxTables(htmlResult.value);
      estimatedMiapTime = timelineEstimate;
      const estimateText = timelineEstimate
        ? `เวลาที่ระบบประมาณจากสีและเซลล์รวม: M ${timelineEstimate.motivation} นาที, I ${timelineEstimate.information} นาที, A ${timelineEstimate.application} นาที, P ${timelineEstimate.progress} นาที (รวม ${timelineEstimate.totalMinutes} นาที)`
        : "";
      text = `${rawResult.value}\n\n${tableText(tables)}\n${estimateText}`;
      warnings.push(...[...rawResult.messages, ...htmlResult.messages]
        .map((message) => message.message)
        .filter((message) => !/^An unrecognised element was ignored:/i.test(message))
        .slice(0, 5));
      if (estimateText) warnings.push(`${estimateText} โปรดตรวจสอบกับแผนภูมิต้นฉบับก่อนนำไปใช้`);
    }

    text = normalizeText(text);
    if (text.length < 80) throw new DocumentExtractionError("no-text");
    if (text.length >= 120_000) warnings.push("ข้อความยาวเกินขีดจำกัด ระบบวิเคราะห์เฉพาะ 120,000 อักขระแรก");

    return {
      format: isPdf ? "pdf" : "docx",
      text,
      pageCount,
      confidence: text.length >= 800 ? "high" : text.length >= 250 ? "medium" : "low",
      warnings,
      tables,
      estimatedMiapTime,
    };
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;
    throw new DocumentExtractionError("unreadable");
  }
}
