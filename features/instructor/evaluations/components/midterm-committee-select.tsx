"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Teacher = { id: string; fullName: string };

export function MidtermCommitteeSelect({ courseId, classroom, groupNumber, slot, teachers, initialValue, canManage }: {
  courseId: string;
  classroom: "CED" | "TCT";
  groupNumber: number;
  slot: number;
  teachers: Teacher[];
  initialValue: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(instructorId: string) {
    const previous = value;
    setValue(instructorId);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/instructor/midterm-committee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, cohort: classroom, groupNumber, slot, instructorId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
      router.refresh();
    } catch (reason) {
      setValue(previous);
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <div className={value ? "committee-slot is-assigned" : "committee-slot"}><label htmlFor={`committee-${classroom}-${groupNumber}-${slot}`}>กรรมการคนที่ {slot}</label>{canManage ? <select id={`committee-${classroom}-${groupNumber}-${slot}`} value={value} disabled={pending} onChange={event => void save(event.target.value)}><option value="">ยังไม่มอบหมาย</option>{teachers.map(teacher => <option value={teacher.id} key={teacher.id}>{teacher.fullName}</option>)}</select> : <strong>{teachers.find(teacher => teacher.id === value)?.fullName || "ยังไม่มอบหมาย"}</strong>}{error && <small role="alert">{error}</small>}</div>;
}
