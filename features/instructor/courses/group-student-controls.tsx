"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type StudentOption = { id: string; label: string };

async function postCourseAction(body: Record<string, unknown>) {
  const response = await fetch("/api/instructor/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
  return result as { roomId?: string };
}

async function resolveRoom(courseId: string, classroom: "CED" | "TCT", groupNumber: number, roomId?: string) {
  if (roomId) return roomId;
  const result = await postCourseAction({ action: "save_room", courseId, name: `กลุ่มที่ ${groupNumber}`, cohort: classroom, instructorId: "" });
  if (!result.roomId) throw new Error("สร้างกลุ่มไม่สำเร็จ");
  return result.roomId;
}

export function StudentGroupSelect({ studentId, courseId, classroom, currentGroup, roomIds, canManage }: {
  studentId: string;
  courseId: string;
  classroom: "CED" | "TCT";
  currentGroup: number;
  roomIds: Array<string | undefined>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!canManage) return <span>กลุ่มที่ {currentGroup}</span>;

  async function changeGroup(value: string) {
    setPending(true);
    setError("");
    try {
      const target = Number(value);
      const roomId = target ? await resolveRoom(courseId, classroom, target, roomIds[target - 1]) : "";
      await postCourseAction({ action: "assign_student", courseId, studentId, roomId });
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return <div className="student-group-control"><select aria-label="ย้ายกลุ่มนักศึกษา" value={currentGroup || ""} disabled={pending} onChange={event => void changeGroup(event.target.value)}>
    {[1, 2, 3, 4].map(group => <option value={group} key={group}>กลุ่มที่ {group}</option>)}
    <option value="">{currentGroup ? "นำออกจากกลุ่ม" : "เลือกกลุ่ม"}</option>
  </select>{error && <small role="alert">{error}</small>}</div>;
}

export function AddStudentToGroup({ students, courseId, classroom, groupNumber, roomId, canManage }: {
  students: StudentOption[];
  courseId: string;
  classroom: "CED" | "TCT";
  groupNumber: number;
  roomId?: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!canManage) return null;

  async function add() {
    const normalized = query.trim().toLocaleLowerCase("th");
    const exact = students.find(student => student.label.toLocaleLowerCase("th") === normalized);
    const matches = students.filter(student => student.label.toLocaleLowerCase("th").includes(normalized));
    const selected = exact || (matches.length === 1 ? matches[0] : undefined);
    if (!selected) {
      setError(normalized ? "กรุณาเลือกนักศึกษาจากรายการค้นหา" : "กรุณาพิมพ์ชื่อหรือรหัสนักศึกษา");
      return;
    }
    setPending(true);
    setError("");
    try {
      const targetRoomId = await resolveRoom(courseId, classroom, groupNumber, roomId);
      await postCourseAction({ action: "assign_student", courseId, studentId: selected.id, roomId: targetRoomId });
      setQuery("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  const listId = `students-${classroom}-${groupNumber}`;
  return <form className="add-group-student" onSubmit={event => { event.preventDefault(); void add(); }}>
    <input list={listId} type="search" value={query} disabled={pending || !students.length} placeholder={students.length ? "ค้นหารหัส ชื่อ หรือนามสกุล" : "ไม่มีนักศึกษารอจัดกลุ่ม"} aria-label={`ค้นหานักศึกษาเพื่อเพิ่มเข้ากลุ่มที่ ${groupNumber}`} onChange={event => { setQuery(event.target.value); setError(""); }} />
    <datalist id={listId}>{students.map(student => <option value={student.label} key={student.id} />)}</datalist>
    <button type="submit" disabled={pending || !students.length}>+ เพิ่ม</button>
    {error && <small role="alert">{error}</small>}
  </form>;
}
