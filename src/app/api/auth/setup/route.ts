import { NextResponse } from "next/server";
import { readDB, updateDB, newId } from "@/lib/db";
import { createSessionToken, hashPassword, jsonError, sessionCookieOptions, SESSION_COOKIE, toPublicUser, validatePassword } from "@/lib/auth";
import { logActivity } from "@/lib/projects";
import { FULL_PERMISSIONS, type User } from "@/lib/types";

/** First-run: tells the UI whether an administrator account still needs to be created. */
export async function GET() {
  const db = await readDB();
  return NextResponse.json({ needsSetup: db.users.length === 0 });
}

/** First-run: create the initial administrator. Disabled once any user exists. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!name) return jsonError("Name is required.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("A valid email is required.", 400);
  const pwError = validatePassword(body.password);
  if (pwError) return jsonError(pwError, 400);

  const result = await updateDB((db) => {
    if (db.users.length > 0) return null;
    const user: User = {
      id: newId("usr_"),
      name,
      email,
      passwordHash: hashPassword(body.password),
      role: "admin",
      permissions: { ...FULL_PERMISSIONS },
      projectAccess: { mode: "all", projectIds: [] },
      active: true,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    db.users.push(user);
    logActivity(db, user, "created the administrator account", user.name);
    return { user, token: createSessionToken(user, db) };
  });

  if (!result) return jsonError("Setup has already been completed. Please sign in.", 409);
  const res = NextResponse.json({ user: toPublicUser(result.user) });
  res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return res;
}
