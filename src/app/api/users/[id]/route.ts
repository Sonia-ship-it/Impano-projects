import { NextResponse } from "next/server";
import { updateDB } from "@/lib/db";
import { hashPassword, jsonError, requireAdmin, toPublicUser, validatePassword } from "@/lib/auth";
import { logActivity } from "@/lib/projects";
import { parseEmail, parsePermissions, parseProjectAccess, parseRole } from "@/lib/users";
import { FULL_PERMISSIONS, type Database } from "@/lib/types";

function activeAdminCount(db: Database) {
  return db.users.filter((u) => u.role === "admin" && u.active).length;
}

/** Admin: update a user's profile, role, permissions, project access, status or password. */
export async function PUT(request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;
  const session = await requireAdmin();
  if (session.error) return session.error;
  const body = await request.json().catch(() => ({}));

  if ("password" in body && body.password) {
    const pwError = validatePassword(body.password);
    if (pwError) return jsonError(pwError, 400);
  }

  const result = await updateDB((db) => {
    const original = db.users.find((u) => u.id === id);
    if (!original) return { error: "User not found.", status: 404 };
    // Work on a copy so a validation error part-way through leaves the stored user untouched.
    const user = structuredClone(original);
    const isSelf = user.id === session.user.id;
    const changes: string[] = [];

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
      if (!name) return { error: "Name is required.", status: 400 };
      if (name !== user.name) changes.push("name");
      user.name = name;
    }
    if ("email" in body) {
      const email = parseEmail(body.email);
      if (!email) return { error: "A valid email is required.", status: 400 };
      if (db.users.some((u) => u.email === email && u.id !== user.id)) return { error: "Another user already uses this email.", status: 409 };
      if (email !== user.email) changes.push("email");
      user.email = email;
    }
    if ("role" in body) {
      const role = parseRole(body.role);
      if (!role) return { error: "Invalid role.", status: 400 };
      if (role !== user.role) {
        if (isSelf) return { error: "You cannot change your own role.", status: 400 };
        if (user.role === "admin" && user.active && activeAdminCount(db) <= 1)
          return { error: "There must always be at least one active administrator.", status: 400 };
        changes.push(`role → ${role}`);
        user.role = role;
        user.sessionVersion += 1;
      }
    }
    if (user.role === "admin") {
      user.permissions = { ...FULL_PERMISSIONS };
      user.projectAccess = { mode: "all", projectIds: [] };
    } else {
      if ("permissions" in body) {
        user.permissions = parsePermissions(body.permissions, user.permissions);
        changes.push("permissions");
      }
      if ("projectAccess" in body) {
        user.projectAccess = parseProjectAccess(body.projectAccess, new Set(db.projects.map((p) => p.id)));
        changes.push("project access");
      }
    }
    if ("active" in body && typeof body.active === "boolean" && body.active !== user.active) {
      if (isSelf) return { error: "You cannot deactivate your own account.", status: 400 };
      if (!body.active && user.role === "admin" && activeAdminCount(db) <= 1)
        return { error: "There must always be at least one active administrator.", status: 400 };
      user.active = body.active;
      user.sessionVersion += 1;
      changes.push(body.active ? "reactivated" : "deactivated");
    }
    if (body.password) {
      user.passwordHash = hashPassword(body.password);
      user.sessionVersion += 1;
      changes.push("password reset");
    }

    Object.assign(original, user);
    if (changes.length) logActivity(db, session.user, "updated user", `${user.name} (${user.email})`, changes.join(", "));
    return { user };
  });

  if ("error" in result) return jsonError(result.error!, result.status!);
  return NextResponse.json({ user: toPublicUser(result.user) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;
  const session = await requireAdmin();
  if (session.error) return session.error;
  if (id === session.user.id) return jsonError("You cannot delete your own account.", 400);

  const result = await updateDB((db) => {
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) return { error: "User not found.", status: 404 };
    const user = db.users[index];
    if (user.role === "admin" && user.active && activeAdminCount(db) <= 1)
      return { error: "There must always be at least one active administrator.", status: 400 };
    db.users.splice(index, 1);
    logActivity(db, session.user, "removed user", `${user.name} (${user.email})`);
    return { ok: true };
  });

  if ("error" in result) return jsonError(result.error!, result.status!);
  return NextResponse.json({ ok: true });
}
