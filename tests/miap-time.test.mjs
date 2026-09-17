import assert from "node:assert/strict";
import test from "node:test";
import { parseMiapTimeAllocation } from "../lib/analysis/miap-time.ts";

test("parses estimated MIAP time into comparable proportions", () => {
  const result = parseMiapTimeAllocation("เวลาที่ระบบประมาณ: M 4 นาที, I 21 นาที, A 12 นาที, P 13 นาที (รวม 50 นาที)");
  assert.equal(result?.isEstimated, true);
  assert.equal(result?.totalMinutes, 50);
  assert.deepEqual(result?.stages.map((stage) => [stage.code, stage.minutes, stage.percent]), [
    ["M", 4, 8], ["I", 21, 42], ["A", 12, 24], ["P", 13, 26],
  ]);
});

test("returns null when a plan does not specify all four MIAP stages", () => {
  assert.equal(parseMiapTimeAllocation("ระยะเวลารวม 50 นาที"), null);
  assert.equal(parseMiapTimeAllocation("M 10 นาที I 20 นาที A 20 นาที"), null);
});
