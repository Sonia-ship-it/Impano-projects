import { NextResponse } from "next/server";
import { newId, updateDB } from "@/lib/db";
import { appUrl, DEFAULT_USER_PASSWORD, hashPassword, jsonError, requireAdmin, toPublicUser } from "@/lib/auth";
import { sendMail, welcomeEmail } from "@/lib/mail";
import { logActivity } from "@/lib/projects";
import { parseEmail, parsePermissions, parseProjectAccess, parseRole } from "@/lib/users";
import { FULL_PERMISSIONS, type User } from "@/lib/types";

/** Admin: list users, plus a light project index for the access picker. */
export async function GET() {
  const session = await requireAdmin();
  if (session.error) return session.error;
  return NextResponse.json({
    users: session.db.users.map(toPublicUser),
    projects: session.db.projects
      .map((p) => ({ id: p.id, code: p.code, title: p.title, status: p.status }))
      .sort((a, b) => b.code.localeCompare(a.code)),
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = parseEmail(body.email);
  const role = parseRole(body.role) ?? "member";
  if (!name) return jsonError("Name is required.", 400);
  if (!email) return jsonError("A valid email is required.", 400);

  const result = await updateDB((db) => {
    if (db.users.some((u) => u.email === email)) return { error: "A user with this email already exists." };
    const user: User = {
      id: newId("usr_"),
      name,
      email,
      passwordHash: hashPassword(DEFAULT_USER_PASSWORD),
      mustChangePassword: true,
      role,
      permissions: role === "admin" ? { ...FULL_PERMISSIONS } : parsePermissions(body.permissions),
      projectAccess: role === "admin" ? { mode: "all", projectIds: [] } : parseProjectAccess(body.projectAccess, new Set(db.projects.map((p) => p.id))),
      active: true,
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    logActivity(db, session.user, `added ${role === "admin" ? "administrator" : "member"}`, `${user.name} (${user.email})`);
    return { user };
  });

  if ("error" in result) return jsonError(result.error!, 409);
  const mail = await sendMail({
    to: result.user.email,
    ...welcomeEmail(result.user.name, result.user.email, DEFAULT_USER_PASSWORD, `${appUrl(request)}/login`),
  });
  return NextResponse.json(
    { user: toPublicUser(result.user), emailSent: mail.sent, emailError: mail.sent ? undefined : mail.reason },
    { status: 201 }
  );
}
