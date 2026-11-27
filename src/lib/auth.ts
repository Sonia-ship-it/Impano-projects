import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ConfigError, readDB } from "./db";
import type { Database, Permissions, PublicUser, User } from "./types";
import { FULL_PERMISSIONS } from "./types";

export const SESSION_COOKIE = "impano_projects_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export { DEFAULT_USER_PASSWORD, hashPassword, validatePassword, verifyPassword } from "./passwords";

/* ---------------- Sessions (signed, stateless cookie) ---------------- */

interface SessionPayload {
  uid: string;
  v: number;
  exp: number;
}

function secret(db: Database) {
  return process.env.SESSION_SECRET || db.meta.sessionSecret;
}

function sign(data: string, key: string) {
  return crypto.createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(user: User, db: Database): string {
  const payload: SessionPayload = { uid: user.id, v: user.sessionVersion, exp: Date.now() + SESSION_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret(db))}`;
}

function readSessionToken(token: string | undefined, db: Database): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data, secret(db));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** Resolve the signed-in user from the session cookie (null if none / invalid / deactivated). */
export async function getSessionUser(): Promise<{ user: User; db: Database } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await readDB();
  const payload = readSessionToken(token, db);
  if (!payload) return null;
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user || !user.active || user.sessionVersion !== payload.v) return null;
  return { user, db };
}

export function effectivePermissions(user: User): Permissions {
  return user.role === "admin" ? { ...FULL_PERMISSIONS } : { ...user.permissions };
}

export function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, sessionVersion, ...rest } = user;
  return rest;
}

/* ---------------- API guards ---------------- */

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

type Guarded = { user: User; db: Database; error?: undefined } | { error: NextResponse; user?: undefined; db?: undefined };

/**
 * Signed-in user, or an error response. Accounts still on the temporary password are blocked
 * from everything except changing it (pass `allowPendingPassword` on those routes).
 */
export async function requireUser(opts: { allowPendingPassword?: boolean } = {}): Promise<Guarded> {
  const session = await getSessionUser();
  if (!session) return { error: jsonError("Not signed in.", 401) };
  if (session.user.mustChangePassword && !opts.allowPendingPassword)
    return { error: NextResponse.json({ error: "Please set a new password first.", code: "password_change_required" }, { status: 403 }) };
  return session;
}

export async function requireAdmin(): Promise<Guarded> {
  const session = await requireUser();
  if (session.error) return session;
  if (session.user.role !== "admin") return { error: jsonError("Administrator access required.", 403) };
  return session;
}

/* ---------------- Login throttling (stored in the database) ---------------- */

const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

/** Seconds until `key` is unlocked (0 when not locked). */
export function isLocked(db: Database, key: string): number {
  const a = db.throttle?.[key];
  if (a && a.until > Date.now()) return Math.ceil((a.until - Date.now()) / 1000);
  return 0;
}

export function recordFailure(db: Database, key: string) {
  db.throttle ??= {};
  const a = db.throttle[key] ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.until = Date.now() + LOCK_MS;
    a.count = 0;
  }
  db.throttle[key] = a;
}

export function clearFailures(db: Database, key: string) {
  if (db.throttle) delete db.throttle[key];
}

/* ---------------- One-time sign-in codes ---------------- */

export const OTP_COOKIE = "impano_projects_otp";
export const OTP_TTL_MIN = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_RESENDS = 5;
export const OTP_RESEND_SECONDS = 30;

export function newOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(code: string, challengeId: string) {
  return crypto.createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

export function otpMatches(code: string, challengeId: string, stored: string) {
  const a = Buffer.from(hashOtp(code, challengeId));
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function otpCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: OTP_TTL_MIN * 60 };
}

/** "uwasesonia43@gmail.com" → "uw•••••••43@gmail.com" */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const keep = local.length <= 4 ? 1 : 2;
  return `${local.slice(0, keep)}${"•".repeat(Math.max(3, local.length - keep * 2))}${local.length > 4 ? local.slice(-2) : ""}@${domain}`;
}

/** Base URL for links in emails: APP_URL if set, else the request's own origin. */
export function appUrl(request: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = request.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/* ---------------- Error handling ---------------- */

/**
 * Wrap a route handler so unexpected failures return JSON (shown in the UI) instead of an HTML 500 page.
 * Configuration problems (e.g. missing storage on Vercel) surface their message so they can be fixed.
 */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error("[api] Unhandled error:", err);
      if (err instanceof ConfigError) return jsonError(`Server setup problem: ${err.message}`, 503);
      return jsonError("Something went wrong on the server. Please try again.", 500);
    }
  };
}
