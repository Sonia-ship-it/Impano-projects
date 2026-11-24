import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readDB } from "./db";
import type { Database, Permissions, PublicUser, User } from "./types";
import { FULL_PERMISSIONS } from "./types";

export const SESSION_COOKIE = "impano_projects_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

/* ---------------- Passwords ---------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  return null;
}

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

export async function requireUser(): Promise<Guarded> {
  const session = await getSessionUser();
  if (!session) return { error: jsonError("Not signed in.", 401) };
  return session;
}

export async function requireAdmin(): Promise<Guarded> {
  const session = await requireUser();
  if (session.error) return session;
  if (session.user.role !== "admin") return { error: jsonError("Administrator access required.", 403) };
  return session;
}

/* ---------------- Login throttling (in-memory) ---------------- */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

export function isLocked(key: string): number {
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return Math.ceil((a.until - Date.now()) / 1000);
  return 0;
}

export function recordFailure(key: string) {
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.until = Date.now() + LOCK_MS;
    a.count = 0;
  }
  attempts.set(key, a);
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
