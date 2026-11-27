import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { updateDB } from "@/lib/db";
import { hashOtp, jsonError, newOtpCode, OTP_COOKIE, OTP_MAX_RESENDS, OTP_RESEND_SECONDS, OTP_TTL_MIN } from "@/lib/auth";
import { mailIsConsoleOnly, otpEmail, sendMail } from "@/lib/mail";

/** Email a fresh code for the pending sign-in. */
export async function POST() {
  const challengeId = (await cookies()).get(OTP_COOKIE)?.value;
  if (!challengeId) return jsonError("Your sign-in expired. Please enter your password again.", 410);
  const code = newOtpCode();

  const result = await updateDB((db) => {
    const challenge = db.otps?.find((o) => o.id === challengeId);
    if (!challenge) return { error: "Your sign-in expired. Please enter your password again.", status: 410 };
    const wait = Math.ceil((challenge.sentAt + OTP_RESEND_SECONDS * 1000 - Date.now()) / 1000);
    if (wait > 0) return { error: `Please wait ${wait}s before requesting another code.`, status: 429 };
    if (challenge.resends >= OTP_MAX_RESENDS) return { error: "Too many codes requested. Please sign in again.", status: 429 };
    const user = db.users.find((u) => u.id === challenge.userId);
    if (!user || !user.active) return { error: "This account is not available.", status: 403 };
    const now = Date.now();
    Object.assign(challenge, { codeHash: hashOtp(code, challenge.id), sentAt: now, expiresAt: now + OTP_TTL_MIN * 60_000, attempts: 0, resends: challenge.resends + 1 });
    return { name: user.name, email: user.email };
  });

  if ("error" in result) return jsonError(result.error!, result.status!);
  const mail = await sendMail({ to: result.email, ...otpEmail(result.name, code, OTP_TTL_MIN) });
  if (!mail.sent) return jsonError(mail.reason, 503);
  return NextResponse.json({ ok: true, ...(mailIsConsoleOnly() ? { devCode: code } : {}) });
}
