"use client";

import Link from "next/link";
import { useSession } from "@/components/AppShell";
import ProjectForm from "@/components/ProjectForm";
import { IconArrowLeft } from "@/components/Icons";

export default function NewProjectPage() {
  const { permissions } = useSession();
  return (
    <>
      <Link href="/projects" className="back-link"><IconArrowLeft /> All projects</Link>
      <header className="page-header">
        <div>
          <div className="section-tag">New Entry</div>
          <h1 className="page-title">New Project</h1>
          <p className="page-sub">Record a production — a project code is assigned automatically.</p>
        </div>
      </header>
      {permissions.editProjects ? (
        <ProjectForm />
      ) : (
        <div className="alert alert-error">⚠️ You do not have permission to create projects.</div>
      )}
    </>
  );
}
