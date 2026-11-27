import { NextResponse } from "next/server";
import { effectivePermissions, requireUser, toPublicUser, withErrors } from "@/lib/auth";
import { storageType } from "@/lib/db";

async function handleGET() {
  const session = await requireUser({ allowPendingPassword: true });
  if (session.error) return session.error;
  return NextResponse.json({
    user: toPublicUser(session.user),
    permissions: effectivePermissions(session.user),
    storage: storageType(),
  });
}

export const GET = withErrors(handleGET);
