import { NextResponse } from "next/server";
import { clearedSessionCookie, revokeSession, SESSION_COOKIE } from "@/lib/server/auth";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  try { await revokeSession(token); } catch { /* The local cookie is still cleared if server-side revocation fails. */ }
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(clearedSessionCookie());
  return response;
}
