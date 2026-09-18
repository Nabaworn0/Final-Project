"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TeacherOption = { id: string; fullName: string };

export function GroupInstructorSelect({ courseId, roomId, classroom, groupNumber, teachers, initialValue, canManage }: {
  courseId: string;
  roomId?: string;
  classroom: "CED" | "TCT";
  groupNumber: number;
  teachers: TeacherOption[];
  initialValue: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function assign(instructorId: string) {
    const previous = value;
    setValue(instructorId);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_room", courseId, id: roomId, name: `กลุ่มที่ ${groupNumber}`, cohort: classroom, instructorId }),
      });
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

  if (!canManage) return <div className={initialValue ? "group-teacher is-assigned" : "group-teacher"}><small>อาจารย์ผู้รับผิดชอบ</small><strong>{teachers.find(teacher => teacher.id === initialValue)?.fullName || "ยังไม่มอบหมาย"}</strong></div>;

  return <div className={value ? "group-teacher is-assigned" : "group-teacher"}>
    <label htmlFor={`group-teacher-${classroom}-${groupNumber}`}>อาจารย์ผู้รับผิดชอบ</label>
    <select id={`group-teacher-${classroom}-${groupNumber}`} value={value} disabled={pending || !teachers.length} onChange={event => void assign(event.target.value)}>
      <option value="">ยังไม่มอบหมาย</option>
      {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
    </select>
    {error && <small className="group-teacher-error" role="alert">{error}</small>}
  </div>;
}
