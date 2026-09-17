import JSZip from "jszip";

export type ImportedStudent = { sequence: string; firstName: string; lastName: string; fullName: string; studentNumber: string };
export type ImportedSheet = { name: string; rows: ImportedStudent[] };

const HEADER_ALIASES = {
  sequence: ["ลำดับที่", "ลำดับ", "เลขที่", "no", "no.", "number"],
  studentNumber: ["รหัสนักศึกษา", "รหัส", "studentid", "student id", "studentnumber", "student number"],
  firstName: ["ชื่อ", "ชื่อจริง", "ชื่อ - สกุล", "ชื่อ-สกุล", "firstname", "first name"],
  lastName: ["สกุล", "นามสกุล", "lastname", "last name", "surname"],
} as const;

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[._()]/g, "").replaceAll("[", "").replaceAll("]", "").replace(/\s+/g, " ");

export function studentRowsFromMatrix(matrix: string[][]): ImportedStudent[] {
  const nonEmpty = matrix.filter(row => row.some(cell => cell.trim()));
  if (!nonEmpty.length) throw new Error("ไม่พบข้อมูลในไฟล์ Excel");
  const headers = nonEmpty[0].map(normalizeHeader);
  const find = (aliases: readonly string[]) => headers.findIndex(header => aliases.some(alias => normalizeHeader(alias) === header));
  const columns = {
    sequence: find(HEADER_ALIASES.sequence),
    studentNumber: find(HEADER_ALIASES.studentNumber),
    firstName: find(HEADER_ALIASES.firstName),
    lastName: find(HEADER_ALIASES.lastName),
  };
  if (columns.lastName < 0 && columns.firstName >= 0 && !headers[columns.firstName + 1]) columns.lastName = columns.firstName + 1;
  if (Object.values(columns).some(index => index < 0)) throw new Error("หัวตารางต้องมี ลำดับที่, รหัสนักศึกษา, ชื่อ และสกุล");
  const rows = nonEmpty.slice(1).map((row, index) => ({
    sequence: (row[columns.sequence] || "").trim(),
    studentNumber: (row[columns.studentNumber] || "").trim(),
    firstName: (row[columns.firstName] || "").trim(),
    lastName: (row[columns.lastName] || "").trim(),
    sourceRow: index + 2,
  })).filter(row => row.sequence || row.studentNumber || row.firstName || row.lastName);
  if (!rows.length) throw new Error("ไฟล์มีหัวตาราง แต่ไม่มีรายชื่อนักศึกษา");
  if (rows.length > 300) throw new Error("นำเข้าได้สูงสุดครั้งละ 300 คน");
  const invalid = rows.find(row => !row.sequence || !row.studentNumber || !row.firstName || !row.lastName);
  if (invalid) throw new Error(`ข้อมูลแถวที่ ${invalid.sourceRow} ไม่ครบ`);
  const numbers = new Set<string>();
  for (const row of rows) {
    if (numbers.has(row.studentNumber)) throw new Error(`พบรหัสนักศึกษาซ้ำในแถวที่ ${row.sourceRow}`);
    numbers.add(row.studentNumber);
  }
  return rows.map(({ sequence, firstName, lastName, studentNumber }) => ({
    sequence,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    studentNumber,
  }));
}

export async function parseStudentWorkbook(file: File): Promise<ImportedSheet[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("รองรับไฟล์ Excel รูปแบบ .xlsx เท่านั้น");
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookText = await zip.file("xl/workbook.xml")?.async("text");
  const relationshipsText = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookText || !relationshipsText) throw new Error("ไม่สามารถอ่านโครงสร้างไฟล์ Excel ได้");
  const parser = new DOMParser();
  const workbook = parser.parseFromString(workbookText, "application/xml");
  const relationships = parser.parseFromString(relationshipsText, "application/xml");
  const sharedText = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings = sharedText
    ? Array.from(parser.parseFromString(sharedText, "application/xml").querySelectorAll("si")).map(item => item.textContent || "")
    : [];
  const importedSheets: ImportedSheet[] = [];
  for (const sheetNode of Array.from(workbook.querySelectorAll("sheet"))) {
    const relationshipId = sheetNode.getAttribute("r:id") || sheetNode.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const relationship = Array.from(relationships.querySelectorAll("Relationship")).find(item => item.getAttribute("Id") === relationshipId);
    const target = relationship?.getAttribute("Target");
    if (!target) continue;
    const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    const sheetText = await zip.file(sheetPath)?.async("text");
    if (!sheetText) continue;
    const sheet = parser.parseFromString(sheetText, "application/xml");
    const matrix = Array.from(sheet.querySelectorAll("sheetData > row")).map(row => {
      const values: string[] = [];
      for (const cell of Array.from(row.querySelectorAll(":scope > c"))) {
        const reference = cell.getAttribute("r") || "A1";
        const letters = reference.match(/[A-Z]+/i)?.[0].toUpperCase() || "A";
        let column = 0;
        for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
        const raw = cell.querySelector(":scope > v")?.textContent || "";
        const type = cell.getAttribute("t");
        values[column - 1] = type === "s" ? sharedStrings[Number(raw)] || "" : type === "inlineStr" ? cell.querySelector("is")?.textContent || "" : raw;
      }
      return values;
    });
    try {
      const rows = studentRowsFromMatrix(matrix);
      importedSheets.push({ name: sheetNode.getAttribute("name")?.trim() || `Sheet ${importedSheets.length + 1}`, rows });
    } catch (error) {
      if (matrix[0]?.some(cell => normalizeHeader(cell).includes("รหัสนักศึกษา"))) throw error;
    }
  }
  if (!importedSheets.length) throw new Error("ไม่พบชีตรายชื่อที่มีหัวตาราง ลำดับที่, รหัสนักศึกษา, ชื่อ และสกุล");
  if (importedSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0) > 300) throw new Error("นำเข้าได้สูงสุดครั้งละ 300 คน");
  return importedSheets;
}
