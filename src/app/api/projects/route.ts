import { NextResponse } from "next/server";
import { newId, updateDB } from "@/lib/db";
import { effectivePermissions, jsonError, requireUser } from "@/lib/auth";
import { logActivity, nextProjectCode, parseProjectInput, toView, visibleProjects } from "@/lib/projects";
import type { Project } from "@/lib/types";

/** List every project the signed-in user may see (fields filtered by permission). */
export async function GET() {
  const session = await requireUser();
  if (session.error) return session.error;
  const projects = visibleProjects(session.user, session.db)
    .map((p) => toView(p, session.user))
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await requireUser();
  if (session.error) return session.error;
  if (!effectivePermissions(session.user).editProjects) return jsonError("You do not have permission to create projects.", 403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request body.", 400);
  const parsed = parseProjectInput(body, session.user, true);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const project = await updateDB((db) => {
    const now = new Date().toISOString();
    const p: Project = {
      ...(parsed.data as Project),
      id: newId("prj_"),
      code: nextProjectCode(db),
      createdAt: now,
      createdBy: session.user.name,
      updatedAt: now,
      updatedBy: session.user.name,
    };
    db.projects.push(p);
    // Members restricted to selected projects automatically get access to what they create.
    const creator = db.users.find((u) => u.id === session.user.id);
    if (creator && creator.role !== "admin" && creator.projectAccess.mode === "selected") {
      creator.projectAccess.projectIds.push(p.id);
    }
    logActivity(db, session.user, "created project", `${p.code} · ${p.title}`);
    return p;
  });

  return NextResponse.json({ project: toView(project, session.user) }, { status: 201 });
}
