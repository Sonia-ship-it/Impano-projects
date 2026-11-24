"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/AppShell";
import ProjectForm from "@/components/ProjectForm";
import { api, Loading } from "@/components/ui";
import { IconArrowLeft } from "@/components/Icons";
import type { ProjectView } from "@/lib/types";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { permissions } = useSession();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ project: ProjectView }>(`/api/projects/${id}`)
      .then((d) => setProject(d.project))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <>
      <Link href={`/projects/${id}`} className="back-link"><IconArrowLeft /> Back to project</Link>
      <header className="page-header">
        <div>
          <div className="section-tag">{project?.code ?? "Edit"}</div>
          <h1 className="page-title">Edit Project</h1>
          {project && <p className="page-sub">{project.title}</p>}
        </div>
      </header>
      {!permissions.editProjects ? (
        <div className="alert alert-error">⚠️ You do not have permission to edit projects.</div>
      ) : error ? (
        <div className="alert alert-error">⚠️ {error}</div>
      ) : !project ? (
        <Loading />
      ) : (
        <ProjectForm project={project} />
      )}
    </>
  );
}
