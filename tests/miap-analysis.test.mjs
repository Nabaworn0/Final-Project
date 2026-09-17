import assert from "node:assert/strict";
import test from "node:test";
import { analyzeMiapPlan } from "../lib/analysis/miap-analysis.ts";

const completePlan = {
  objectives: "ผู้เรียนสามารถพิมพ์ข้อความภาษาไทยได้ถูกต้องอย่างน้อยร้อยละ 80 และตรวจสอบข้อผิดพลาดของตนเองได้",
  motivation: "ครูตั้งคำถามจากสถานการณ์งานสำนักงาน ทบทวนประสบการณ์เดิมและกระตุ้นให้ผู้เรียนค้นหาวิธีพิมพ์ที่ถูกต้อง",
  information: "ครูอธิบายหลักการวางนิ้ว สาธิตขั้นตอนการพิมพ์ และยกตัวอย่างข้อความภาษาไทยเพื่อให้พิมพ์ได้ถูกต้อง",
  application: "ผู้เรียนลงมือฝึกพิมพ์ข้อความภาษาไทย สร้างชิ้นงาน และตรวจสอบข้อผิดพลาดตามโจทย์ด้วยตนเอง",
  progress: "ครูตรวจชิ้นงานระหว่างฝึกและให้ข้อมูลย้อนกลับ ก่อนให้ผู้เรียนสะท้อนผลการพัฒนา",
  assessment: "ประเมินชิ้นงานพิมพ์ข้อความด้วยเกณฑ์ความถูกต้องอย่างน้อยร้อยละ 80 และตรวจรายการข้อผิดพลาด",
  timeAllocation: "Motivation 10 นาที Information 20 นาที Application 40 นาที Progress 20 นาที",
  durationMinutes: 90,
};

test("MIAP v2 recognizes measurable, aligned and timed lesson plans", () => {
  const analysis = analyzeMiapPlan(completePlan);
  assert.equal(analysis.rubricVersion, "miap-v2");
  assert.ok(analysis.structureScore >= 75);
  assert.ok(analysis.alignmentScore >= 75);
  assert.equal(analysis.results.find((item) => item.code === "OQ")?.score, 3);
  assert.equal(analysis.results.find((item) => item.code === "AT")?.score, 3);
});

test("MIAP v2 prioritizes missing evidence instead of inflating scores from long text", () => {
  const repeated = "เนื้อหาทั่วไป ".repeat(30);
  const analysis = analyzeMiapPlan({ objectives: "เพื่อให้ผู้เรียนมีความรู้และความเข้าใจ", motivation: repeated,
    information: repeated, application: repeated, progress: repeated, assessment: repeated,
    timeAllocation: "ระยะเวลารวม 60 นาที", durationMinutes: 60 });
  assert.ok(analysis.structureScore < 50);
  assert.ok(analysis.alignmentScore < 50);
  assert.match(analysis.summary, /ประเด็นเร่งด่วน/);
});

test("time allocation requires four named MIAP stages", () => {
  const analysis = analyzeMiapPlan({ ...completePlan, timeAllocation: "กิจกรรม 10 นาที 20 นาที 40 นาที 20 นาที" });
  assert.equal(analysis.results.find((item) => item.code === "AT")?.score, 1);
});
