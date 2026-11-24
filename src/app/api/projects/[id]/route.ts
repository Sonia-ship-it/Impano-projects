import { NextResponse } from "next/server";
import { updateDB } from "@/lib/db";
import { effectivePermissions, jsonError, requireUser } from "@/lib/auth";
import { canAccessProject, logActivity, parseProjectInput, toView } from "@/lib/projects";
import { STATUS_LABELS } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const session = await requireUser();
  if (session.error) return session.error;
  const project = session.db.projects.find((p) => p.id === id);
  if (!project || !canAccessProject(session.user, id)) return jsonError("Project not found.", 404);
  return NextResponse.json({ project: toView(project, session.user) });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const session = await requireUser();
  if (session.error) return session.error;
  if (!canAccessProject(session.user, id)) return jsonError("Project not found.", 404);
  if (!effectivePermissions(session.user).editProjects) return jsonError("You do not have permission to edit projects.", 403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request body.", 400);
  const parsed = parseProjectInput(body, session.user, false);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const updated = await updateDB((db) => {
    const project = db.projects.find((p) => p.id === id);
    if (!project) return null;
    const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
      (k) => JSON.stringify(project[k]) !== JSON.stringify(parsed.data[k]),
    );
    const statusChanged = parsed.data.status && parsed.data.status !== project.status;
    const prevStatus = project.status;
    Object.assign(project, parsed.data, { updatedAt: new Date().toISOString(), updatedBy: session.user.name });
    if (changed.length) {
      logActivity(
        db,
        session.user,
        statusChanged ? `moved project from ${STATUS_LABELS[prevStatus]} to ${STATUS_LABELS[project.status]}` : "updated project",
        `${project.code} · ${project.title}`,
        `Changed: ${changed.join(", ")}`,
      );
    }
    return project;
  });

  if (!updated) return jsonError("Project not found.", 404);
  return NextResponse.json({ project: toView(updated, session.user) });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const session = await requireUser();
  if (session.error) return session.error;
  if (session.user.role !== "admin") return jsonError("Only administrators can delete projects.", 403);

  const removed = await updateDB((db) => {
    const index = db.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;
    const [project] = db.projects.splice(index, 1);
    for (const u of db.users) u.projectAccess.projectIds = u.projectAccess.projectIds.filter((x) => x !== id);
    logActivity(db, session.user, "deleted project", `${project.code} · ${project.title}`);
    return project;
  });

  if (!removed) return jsonError("Project not found.", 404);
  return NextResponse.json({ ok: true });
}
