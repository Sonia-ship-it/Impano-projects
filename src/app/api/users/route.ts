import { NextResponse } from "next/server";
import { newId, updateDB } from "@/lib/db";
import { hashPassword, jsonError, requireAdmin, toPublicUser, validatePassword } from "@/lib/auth";
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
  const pwError = validatePassword(body.password);
  if (pwError) return jsonError(pwError, 400);

  const result = await updateDB((db) => {
    if (db.users.some((u) => u.email === email)) return { error: "A user with this email already exists." };
    const user: User = {
      id: newId("usr_"),
      name,
      email,
      passwordHash: hashPassword(body.password),
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
  return NextResponse.json({ user: toPublicUser(result.user) }, { status: 201 });
}
