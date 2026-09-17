import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "../../db/schema";

const SESSION_COOKIE = "ced_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const DEMO_PASSWORD_HASHES = {
  student: "pbkdf2_sha256$210000$Y2VkLXN0dWRlbnQtZGVtby0yMDI2$RK8kCRkYnH6VeXJinjRQR2QHKvNngl4knvs1SO8M164=",
  instructor: "pbkdf2_sha256$210000$Y2VkLWluc3RydWN0b3ItZGVtby0yMDI2$JpVzZrHyp6BKTr/zY3eUWMAFBaKLGtxDSGSY6bDBDq4=",
} as const;

export type AuthUser = { id: string; email: string; fullName: string; role: UserRole };
let initialization: Promise<void> | null = null;

function getD1() {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
}

export function initializeAuthDatabase(): Promise<void> {
  if (initialization) return initialization;
  initialization = (async () => {
    const d1 = getD1();
    await d1.batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'instructor')),
        is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)"),
    ]);
    const now = Date.now();
    await d1.batch([
      d1.prepare(`INSERT OR IGNORE INTO users
        (id, email, password_hash, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 'student', 1, ?)`)
        .bind("student-demo", "student@email.kmutnb.ac.th", DEMO_PASSWORD_HASHES.student, "ณัฐพงษ์ ใจดี", now),
      d1.prepare(`INSERT OR IGNORE INTO users
        (id, email, password_hash, full_name, role, is_active, created_at)
        VALUES (?, ?, ?, ?, 'instructor', 1, ?)`)
        .bind("instructor-demo", "instructor@email.kmutnb.ac.th", DEMO_PASSWORD_HASHES.instructor, "อาจารย์นิเทศก์", now),
      d1.prepare("UPDATE users SET email = ? WHERE id = ?").bind("student@email.kmutnb.ac.th", "student-demo"),
      d1.prepare("UPDATE users SET email = ? WHERE id = ?").bind("instructor@email.kmutnb.ac.th", "instructor-demo"),
    ]);
  })().catch((error) => { initialization = null; throw error; });
  return initialization;
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  await initializeAuthDatabase();
  const normalizedEmail = normalizeUniversityEmail(email);
  if (!normalizedEmail) return null;
  const row = await getD1().prepare(`SELECT id, email, password_hash AS passwordHash,
      full_name AS fullName, role FROM users
      WHERE email = ? AND is_active = 1 LIMIT 1`)
    .bind(normalizedEmail).first<AuthUser & { passwordHash: string }>();
  if (!row || !(await verifyPassword(password, row.passwordHash))) return null;
  return { id: row.id, email: row.email, fullName: row.fullName, role: row.role };
}

export function normalizeUniversityEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1 || email.slice(atIndex + 1) !== "email.kmutnb.ac.th" || email.length > 254) return null;
  return email;
}

export async function createSession(userId: string): Promise<string> {
  await initializeAuthDatabase();
  const token = randomToken();
  const now = Date.now();
  await getD1().prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(token), userId, now + SESSION_MAX_AGE_SECONDS * 1000, now).run();
  return token;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await initializeAuthDatabase();
  return await getD1().prepare(`SELECT users.id, users.email, users.full_name AS fullName, users.role
      FROM sessions INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.is_active = 1 LIMIT 1`)
    .bind(await sha256(token), Date.now()).first<AuthUser>() ?? null;
}

export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(user.role === "student" ? "/student/dashboard" : "/instructor/students");
  return user;
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await initializeAuthDatabase();
  await getD1().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MAX_AGE_SECONDS };
}
export function clearedSessionCookie() { return { ...sessionCookie(""), maxAge: 0 }; }
export { SESSION_COOKIE };

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationsText, saltBase64, hashBase64] = storedHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2_sha256" || !Number.isSafeInteger(iterations) || iterations < 100_000 || !saltBase64 || !hashBase64) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltBase64), iterations }, key, 256));
  return constantTimeEqual(derived, fromBase64(hashBase64));
}
async function sha256(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
function randomToken(): string { return toBase64Url(crypto.getRandomValues(new Uint8Array(32))); }
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function toBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}
