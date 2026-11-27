import { NextResponse } from "next/server";
import { OTP_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OTP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
