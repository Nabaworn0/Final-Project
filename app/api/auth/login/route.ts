import { NextResponse } from "next/server";
import { authenticateUser, createSession, sessionCookie } from "@/lib/server/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  }
  try {
    const user = await authenticateUser(email, password);
    if (!user) return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
    const response = NextResponse.redirect(new URL(user.role === "student" ? "/student/dashboard" : "/instructor/students", request.url), 303);
    response.cookies.set(sessionCookie(await createSession(user.id)));
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=unavailable", request.url), 303);
  }
}
