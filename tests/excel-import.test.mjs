import assert from "node:assert/strict";
import test from "node:test";
import { studentRowsFromMatrix } from "../features/instructor/courses/excel-import.ts";

test("maps the four Thai roster columns", () => {
  assert.deepEqual(studentRowsFromMatrix([
    ["ลำดับที่", "รหัสนักศึกษา", "ชื่อ", "สกุล"],
    ["1", "6500000001", "สมชาย", "ใจดี"],
  ]), [{ sequence: "1", firstName: "สมชาย", lastName: "ใจดี", fullName: "สมชาย ใจดี", studentNumber: "6500000001" }]);
});

test("rejects incomplete headers, rows, and duplicate student IDs", () => {
  assert.throws(() => studentRowsFromMatrix([["ชื่อ", "รหัส"], ["ก", "1"]]), /หัวตาราง/);
  assert.throws(() => studentRowsFromMatrix([["ลำดับที่", "รหัสนักศึกษา", "ชื่อ", "สกุล"], ["1", "1", "ก", ""]]), /แถวที่ 2/);
  assert.throws(() => studentRowsFromMatrix([["ลำดับที่", "รหัสนักศึกษา", "ชื่อ", "สกุล"], ["1", "1", "ก", "ข"], ["2", "1", "ค", "ง"]]), /ซ้ำ/);
});
