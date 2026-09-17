export type MiapTimeStage = {
  code: "M" | "I" | "A" | "P";
  name: "Motivation" | "Information" | "Application" | "Progress";
  minutes: number;
  percent: number;
};

export type MiapTimeBreakdown = {
  stages: MiapTimeStage[];
  totalMinutes: number;
  isEstimated: boolean;
};

const STAGES = [
  { code: "M", name: "Motivation" },
  { code: "I", name: "Information" },
  { code: "A", name: "Application" },
  { code: "P", name: "Progress" },
] as const;

export function parseMiapTimeAllocation(value: string): MiapTimeBreakdown | null {
  const stages = STAGES.map((stage) => {
    const match = value.match(new RegExp(`(?:\\b${stage.code}\\b|${stage.name})\\s*[:=–—-]?\\s*(\\d+(?:\\.\\d+)?)\\s*นาที`, "i"));
    return match ? { ...stage, minutes: Number(match[1]) } : null;
  });
  if (stages.some((stage) => !stage || !Number.isFinite(stage.minutes) || stage.minutes <= 0)) return null;
  const validStages = stages as Array<(typeof STAGES)[number] & { minutes: number }>;
  const totalMinutes = validStages.reduce((sum, stage) => sum + stage.minutes, 0);
  return {
    stages: validStages.map((stage) => ({ ...stage, percent: Math.round(stage.minutes / totalMinutes * 100) })),
    totalMinutes,
    isEstimated: /เวลาที่ระบบประมาณ/.test(value),
  };
}
