"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/AppShell";
import { api, ConfirmDialog, Loading, PaymentBadge, StatusBadge, useToast } from "@/components/ui";
import { IconArrowLeft, IconEdit, IconLock, IconTrash } from "@/components/Icons";
import { date, dateTime, money } from "@/lib/format";
import { PROJECT_STATUSES, STATUS_LABELS, type ProjectStatus, type ProjectView } from "@/lib/types";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { permissions, isAdmin } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ project: ProjectView }>(`/api/projects/${id}`)
      .then((d) => setProject(d.project))
      .catch((e) => setError(e.message));
  }, [id]);

  const changeStatus = async (status: ProjectStatus) => {
    if (!project || status === project.status) return;
    setBusy(true);
    try {
      const d = await api<{ project: ProjectView }>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
      setProject(d.project);
      toast(`Status changed to ${STATUS_LABELS[status]}.`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      toast("Project deleted.", "success");
      router.replace("/projects");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (error)
    return (
      <>
        <Link href="/projects" className="back-link"><IconArrowLeft /> All projects</Link>
        <div className="alert alert-error">⚠️ {error}</div>
      </>
    );
  if (!project) return <Loading label="Loading project…" />;

  const t = project.totals;
  const paidPct = t && project.amountCharged ? Math.min(100, Math.round((t.amountPaid / project.amountCharged) * 100)) : 0;

  return (
    <>
      <Link href="/projects" className="back-link"><IconArrowLeft /> All projects</Link>
      <header className="page-header">
        <div style={{ minWidth: 0 }}>
          <div className="section-tag">{project.code}</div>
          <h1 className="page-title" style={{ wordBreak: "break-word" }}>{project.title}</h1>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge status={project.status} />
            {t && <PaymentBadge status={t.paymentStatus} />}
            {project.category && <span className="badge badge-muted no-dot">{project.category}</span>}
          </div>
        </div>
        <div className="header-actions">
          {permissions.editProjects && (
            <>
              <select className="select" value={project.status} onChange={(e) => changeStatus(e.target.value as ProjectStatus)} disabled={busy} aria-label="Change status" style={{ width: "auto" }}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <Link href={`/projects/${id}/edit`} className="btn btn-gold"><IconEdit /> Edit</Link>
            </>
          )}
          {isAdmin && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><IconTrash /> Delete</button>
          )}
        </div>
      </header>

      <div className="grid-3">
        <div>
          <section className="panel">
            <h2 className="panel-title">Project Details</h2>
            <dl className="detail-list">
              <Item label="Category" value={project.category} />
              <Item label="Location" value={project.location} />
              <Item label="Start date" value={date(project.startDate)} />
              <Item label="End / delivery date" value={date(project.endDate)} />
              <Item label="Project lead" value={project.projectLead} />
              <div className="detail-item">
                <dt>Crew / team</dt>
                <dd>{project.team?.length ? <div className="chips">{project.team.map((m) => <span key={m} className="chip">{m}</span>)}</div> : "—"}</dd>
              </div>
              <Item label="Description" value={project.description} full />
              <div className="detail-item full">
                <dt>Deliverables</dt>
                <dd>
                  {project.deliverables?.length ? (
                    <ul style={{ paddingLeft: "1.1rem" }}>{project.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  ) : "—"}
                </dd>
              </div>
              <div className="detail-item full">
                <dt>Final delivery link</dt>
                <dd>{project.deliveryLink ? <a href={project.deliveryLink} target="_blank" rel="noopener noreferrer">{project.deliveryLink}</a> : "—"}</dd>
              </div>
            </dl>
          </section>

          {t && (
            <section className="panel">
              <h2 className="panel-title">Payments <small>{project.payments?.length ?? 0} recorded</small></h2>
              {project.payments?.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {project.payments.map((p) => (
                        <tr key={p.id}><td className="muted">{date(p.date)}</td><td>{p.method || "—"}</td><td className="muted">{p.reference || "—"}</td><td className="num">{money(p.amount, project.currency)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="restricted">No payments recorded yet.</p>}

              <h2 className="panel-title" style={{ marginTop: "2rem" }}>Expenses <small>{project.expenses?.length ?? 0} recorded</small></h2>
              {project.expenses?.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Description</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {project.expenses.map((x) => (
                        <tr key={x.id}><td className="muted">{date(x.date)}</td><td>{x.description}</td><td className="num">{money(x.amount, project.currency)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="restricted">No expenses recorded.</p>}
            </section>
          )}

          {permissions.viewNotes && (
            <section className="panel">
              <h2 className="panel-title">Internal Notes</h2>
              <p style={{ whiteSpace: "pre-wrap", color: project.notes ? "var(--text-soft)" : "var(--text-muted)" }}>{project.notes || "No notes."}</p>
            </section>
          )}
        </div>

        <div>
          <section className="panel">
            <h2 className="panel-title">Financial Summary</h2>
            {t ? (
              <>
                <div className="stat-label">Collected</div>
                <div className="stat-value gold">{paidPct}%</div>
                <div className="progress" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${paidPct}%` }} /></div>
                <div className="money-rows">
                  <div className="money-row"><span>Amount charged</span><strong>{money(project.amountCharged, project.currency)}</strong></div>
                  <div className="money-row"><span>Amount paid</span><strong>{money(t.amountPaid, project.currency)}</strong></div>
                  <div className="money-row"><span>Balance due</span><strong style={{ color: t.balance > 0 ? "var(--warning)" : undefined }}>{money(t.balance, project.currency)}</strong></div>
                  <div className="money-row"><span>Expenses</span><strong>{money(t.totalExpenses, project.currency)}</strong></div>
                  <div className="money-row total"><span>Profit</span><strong>{money(t.profit, project.currency)}</strong></div>
                </div>
              </>
            ) : (
              <div className="restricted"><IconLock /> Restricted by the administrator.</div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Client</h2>
            <dl className="detail-list" style={{ gridTemplateColumns: "1fr" }}>
              <Item label="Name" value={project.clientName} />
              <Item label="Company" value={project.clientCompany} />
              {permissions.viewClientContacts ? (
                <>
                  <div className="detail-item"><dt>Email</dt><dd>{project.clientEmail ? <a href={`mailto:${project.clientEmail}`}>{project.clientEmail}</a> : "—"}</dd></div>
                  <div className="detail-item"><dt>Phone</dt><dd>{project.clientPhone ? <a href={`tel:${project.clientPhone}`}>{project.clientPhone}</a> : "—"}</dd></div>
                </>
              ) : (
                <div className="restricted"><IconLock /> Contact details restricted.</div>
              )}
            </dl>
          </section>

          <section className="panel">
            <h2 className="panel-title">Record</h2>
            <dl className="detail-list" style={{ gridTemplateColumns: "1fr" }}>
              <Item label="Created" value={`${dateTime(project.createdAt)} by ${project.createdBy}`} />
              <Item label="Last updated" value={`${dateTime(project.updatedAt)} by ${project.updatedBy}`} />
            </dl>
          </section>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete project?"
          message={<>This permanently deletes <strong>{project.code} · {project.title}</strong> including its payments and expenses. This cannot be undone.</>}
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          busy={busy}
        />
      )}
    </>
  );
}

function Item({ label, value, full }: { label: string; value?: string; full?: boolean }) {
  return (
    <div className={`detail-item ${full ? "full" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
