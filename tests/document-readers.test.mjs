import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { DocumentExtractionError, extractDocument } from "../lib/analysis/document-extraction.ts";
import { structureDocumentAsMiap } from "../lib/analysis/document-miapping.ts";
import { analyzeMiapPlan } from "../lib/analysis/miap-analysis.ts";

function createDocx(text) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
    </w:body></w:document>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

function createPdf(text) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length + 35} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

async function createTableDocx() {
  const zip = await JSZip.loadAsync(await createDocx("table lesson plan"));
  const cell = (value, span = 1, fill = "") => `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${fill ? `<w:shd w:val="clear" w:fill="${fill}"/>` : ""}</w:tcPr><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
  const row = (...values) => `<w:tr>${values.map(cell).join("")}</w:tr>`;
  const phaseRow = `<w:tr>${[
    cell("วัตถุประสงค์", 3), cell("M", 2, "92D050"), cell("1", 4, "5DD5FF"), cell("2", 6, "FF99FF"),
    cell("A", 7, "FFC000"), cell("สรุป", 2, "EE0000"), cell("P", 4, "0033CC"),
  ].join("")}</w:tr>`;
  zip.file("word/document.xml", `<?xml version="1.0"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
      <w:tbl>${row("เวลา (นาที)", "10", "20", "30", "40", "50")}${phaseRow}</w:tbl>
      <w:tbl>
        ${row("ขั้นการสอน", "กิจกรรม", "สิ่งสนับสนุน")}
        ${row("M", "ครูตั้งคำถามจากสถานการณ์จริงและทบทวนความรู้เดิมของผู้เรียน", "วิดีโอ")}
        ${row("I", "ครูอธิบายหลักการ สาธิตขั้นตอน และยกตัวอย่างให้ผู้เรียนสังเกต", "ใบเนื้อหา")}
        ${row("A", "ผู้เรียนลงมือฝึกปฏิบัติและสร้างชิ้นงานตามโจทย์", "ใบกิจกรรม")}
        ${row("P", "ครูตรวจชิ้นงาน ประเมินตามเกณฑ์ และให้ข้อมูลย้อนกลับ", "แบบประเมิน")}
      </w:tbl>
    </w:body></w:document>`);
  return zip.generateAsync({ type: "arraybuffer" });
}

test("Mammoth extracts raw text from a DOCX buffer", async () => {
  const file = new File([await createDocx("MIAP Motivation Information Application Progress with enough readable lesson-plan text for analysis")], "plan.docx");
  const result = await extractDocument(file);
  assert.equal(result.format, "docx");
  assert.match(result.text, /Motivation Information Application Progress/);
});

test("DOCX tables preserve MIAP activity columns and timeline duration", async () => {
  const file = new File([await createTableDocx()], "table-plan.docx");
  const extraction = await extractDocument(file);
  const structured = structureDocumentAsMiap(extraction.text, file.name, extraction.tables, extraction.estimatedMiapTime);
  assert.ok(extraction.tables.some((row) => row[0] === "M"));
  assert.match(structured.motivation, /สถานการณ์จริง/);
  assert.match(structured.application, /ลงมือฝึกปฏิบัติ/);
  assert.equal(structured.durationMinutes, 50);
  assert.deepEqual(extraction.estimatedMiapTime && {
    M: extraction.estimatedMiapTime.motivation,
    I: extraction.estimatedMiapTime.information,
    A: extraction.estimatedMiapTime.application,
    P: extraction.estimatedMiapTime.progress,
  }, { M: 4, I: 20, A: 14, P: 12 });
  assert.match(structured.timeAllocation, /เวลาที่ระบบประมาณ/);
  const timeCriterion = analyzeMiapPlan(structured).results.find((item) => item.code === "AT");
  assert.equal(timeCriterion?.score, 2);
  assert.equal(timeCriterion?.confidence, "medium");
  assert.doesNotMatch(structured.mappingWarnings.join(" "), /Motivation/);
});

test("unpdf extracts text from a text-layer PDF buffer", async () => {
  const file = new File([createPdf("MIAP lesson plan with Motivation Information Application Progress and assessment details")], "plan.pdf");
  const result = await extractDocument(file);
  assert.equal(result.pageCount, 1);
  assert.match(result.text, /MIAP lesson plan/);
});

test("a PDF without a usable text layer is rejected for the OCR fallback", async () => {
  const file = new File([createPdf("")], "scanned.pdf");
  await assert.rejects(() => extractDocument(file), (error) => error instanceof DocumentExtractionError && error.code === "no-text");
});
