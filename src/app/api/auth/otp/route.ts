import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateDB } from "@/lib/db";
import {
  createSessionToken,
  jsonError,
  OTP_COOKIE,
  OTP_MAX_ATTEMPTS,
  otpMatches,
  SESSION_COOKIE,
  sessionCookieOptions,
  withErrors,
} from "@/lib/auth";
import { logActivity } from "@/lib/projects";

/** Step 2 of sign-in: confirm the emailed code and start the session. */
async function handlePOST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  const challengeId = (await cookies()).get(OTP_COOKIE)?.value;
  if (!challengeId) return jsonError("Your sign-in expired. Please enter your password again.", 410);
  if (code.length !== 6) return jsonError("Enter the 6-digit code from your email.", 400);

  const result = await updateDB((db) => {
    const challenge = db.otps?.find((o) => o.id === challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) return { error: "This code has expired. Please sign in again.", status: 410 };
    const user = db.users.find((u) => u.id === challenge.userId);
    if (!user || !user.active) return { error: "This account is not available.", status: 403 };

    if (!otpMatches(code, challenge.id, challenge.codeHash)) {
      challenge.attempts += 1;
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        db.otps = db.otps!.filter((o) => o.id !== challenge.id);
        return { error: "Too many wrong codes. Please sign in again.", status: 410 };
      }
      const left = OTP_MAX_ATTEMPTS - challenge.attempts;
      return { error: `That code is not correct. ${left} attempt${left === 1 ? "" : "s"} left.`, status: 401 };
    }

    db.otps = db.otps!.filter((o) => o.id !== challenge.id);
    user.lastLoginAt = new Date().toISOString();
    logActivity(db, user, "signed in", user.email);
    return { token: createSessionToken(user, db), mustChangePassword: !!user.mustChangePassword };
  });

  const res =
    "error" in result
      ? jsonError(result.error!, result.status!)
      : NextResponse.json({ ok: true, mustChangePassword: result.mustChangePassword });
  if ("token" in result) res.cookies.set(SESSION_COOKIE, result.token!, sessionCookieOptions());
  if (!("error" in result) || result.status === 410) res.cookies.set(OTP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export const POST = withErrors(handlePOST);
