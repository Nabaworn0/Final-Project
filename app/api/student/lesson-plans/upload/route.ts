import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { storeLessonPlanReference } from "@/lib/server/lesson-plans";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_REQUEST_SIZE = 22 * 1024 * 1024;

function redirectWithError(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/student/lesson-plans/upload?error=${error}`, request.url), 303);
}

async function hasAcceptedSignature(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = header.length >= 5 && String.fromCharCode(...header) === "%PDF-";
  const isDocx = header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
  return file.name.toLowerCase().endsWith(".pdf") ? isPdf : file.name.toLowerCase().endsWith(".docx") && isDocx;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);
  if (user.role !== "student") return NextResponse.redirect(new URL("/instructor/students", request.url), 303);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) return redirectWithError(request, "file-too-large");

  try {
    const formData = await request.formData();
    const value = formData.get("attachment");
    const title = formData.get("title");
    const course = formData.get("course");
    if (!(value instanceof File) || value.size === 0) return redirectWithError(request, "file-required");
    if (typeof title !== "string" || title.trim().length < 3 || title.length > 160 ||
        typeof course !== "string" || course.trim().length < 2 || course.length > 160) {
      return redirectWithError(request, "unavailable");
    }
    if (value.size > MAX_FILE_SIZE) return redirectWithError(request, "file-too-large");
    if (!/\.(pdf|docx)$/i.test(value.name) || !(await hasAcceptedSignature(value))) {
      return redirectWithError(request, "file-type");
    }

    await storeLessonPlanReference(user.id, { title: title.trim(), course: course.trim(), attachment: value });
    return NextResponse.redirect(new URL("/student/lesson-plans?uploaded=1", request.url), 303);
  } catch {
    return redirectWithError(request, "unavailable");
  }
}
