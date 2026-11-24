import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (session.error) return session.error;
  const limit = Math.min(500, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 200));
  return NextResponse.json({ activity: session.db.activity.slice(0, limit) });
}
