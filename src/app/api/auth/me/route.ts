import { NextResponse } from "next/server";
import { effectivePermissions, requireUser, toPublicUser } from "@/lib/auth";
import { storageType } from "@/lib/db";

export async function GET() {
  const session = await requireUser({ allowPendingPassword: true });
  if (session.error) return session.error;
  return NextResponse.json({
    user: toPublicUser(session.user),
    permissions: effectivePermissions(session.user),
    storage: storageType(),
  });
}
