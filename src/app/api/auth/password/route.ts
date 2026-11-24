import { NextResponse } from "next/server";
import { updateDB } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  jsonError,
  requireUser,
  sessionCookieOptions,
  SESSION_COOKIE,
  validatePassword,
  verifyPassword,
} from "@/lib/auth";
import { logActivity } from "@/lib/projects";

/** Change your own password. Signs out all other sessions. */
export async function POST(request: Request) {
  const session = await requireUser();
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));
  const pwError = validatePassword(body.newPassword);
  if (pwError) return jsonError(pwError, 400);

  const result = await updateDB((db) => {
    const user = db.users.find((u) => u.id === session.user.id);
    if (!user) return { error: "Account not found." };
    if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.passwordHash))
      return { error: "Current password is incorrect." };
    user.passwordHash = hashPassword(body.newPassword);
    user.sessionVersion += 1;
    logActivity(db, user, "changed their password", user.email);
    return { token: createSessionToken(user, db) };
  });

  if ("error" in result) return jsonError(result.error!, 400);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return res;
}
