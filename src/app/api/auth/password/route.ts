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

/**
 * Change your own password. Signs out all other sessions.
 * Accounts still on the temporary password don't need to re-enter it (they just proved it + the emailed code).
 */
export async function POST(request: Request) {
  const session = await requireUser({ allowPendingPassword: true });
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));
  const pwError = validatePassword(body.newPassword);
  if (pwError) return jsonError(pwError, 400);

  const result = await updateDB((db) => {
    const user = db.users.find((u) => u.id === session.user.id);
    if (!user) return { error: "Account not found." };
    if (!user.mustChangePassword) {
      if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.passwordHash))
        return { error: "Current password is incorrect." };
      if (body.currentPassword === body.newPassword) return { error: "The new password must be different from the current one." };
    }
    const wasTemporary = !!user.mustChangePassword;
    user.passwordHash = hashPassword(body.newPassword);
    user.mustChangePassword = false;
    user.sessionVersion += 1;
    logActivity(db, user, wasTemporary ? "set their own password" : "changed their password", user.email);
    return { token: createSessionToken(user, db) };
  });

  if ("error" in result) return jsonError(result.error!, 400);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return res;
}
