"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/AppShell";
import { api, Loading, PaymentBadge, StatusBadge } from "@/components/ui";
import { IconFilm, IconPlus } from "@/components/Icons";
import { compactMoney, date, money } from "@/lib/format";
import { PROJECT_STATUSES, STATUS_LABELS, type ProjectView } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardPage() {
  const { user, permissions } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectView[] | null>(null);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<string>("");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    api<{ projects: ProjectView[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
  }, []);

  const currencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects ?? []) if (p.currency) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [projects]);
  const activeCurrency = currency || currencies[0] || "RWF";

  const stats = useMemo(() => {
    const list = projects ?? [];
    const byStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as Record<string, number>;
    for (const p of list) byStatus[p.status]++;
    const inCur = list.filter((p) => p.currency === activeCurrency && p.status !== "cancelled");
    const sum = (f: (p: ProjectView) => number) => inCur.reduce((s, p) => s + f(p), 0);
    const charged = sum((p) => p.amountCharged ?? 0);
    const collected = sum((p) => p.totals?.amountPaid ?? 0);
    const outstanding = sum((p) => Math.max(0, p.totals?.balance ?? 0));
    const expenses = sum((p) => p.totals?.totalExpenses ?? 0);

    // Last 12 months: money collected (financial users) or projects completed (everyone else).
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()], year: d.getFullYear(), value: 0 };
    });
    const idx = new Map(months.map((m, i) => [m.key, i]));
    if (permissions.viewFinancials) {
      for (const p of inCur) for (const pay of p.payments ?? []) {
        const i = idx.get(pay.date?.slice(0, 7));
        if (i != null) months[i].value += pay.amount;
      }
    } else {
      for (const p of list) if (p.status === "completed" && p.endDate) {
        const i = idx.get(p.endDate.slice(0, 7));
        if (i != null) months[i].value += 1;
      }
    }
    const outstandingList = inCur
      .filter((p) => (p.totals?.balance ?? 0) > 0)
      .sort((a, b) => (b.totals!.balance - a.totals!.balance))
      .slice(0, 5);
    return { total: list.length, byStatus, charged, collected, outstanding, expenses, months, outstandingList };
  }, [projects, activeCurrency, permissions.viewFinancials]);

  if (error) return <div className="alert alert-error">⚠️ {error}</div>;
  if (!projects) return <Loading label="Loading dashboard…" />;

  const active = stats.byStatus.planned + stats.byStatus.in_progress + stats.byStatus.post_production;
  const maxMonth = Math.max(1, ...stats.months.map((m) => m.value));
  const fmtMonth = (v: number) => (permissions.viewFinancials ? money(v, activeCurrency) : `${v} project${v === 1 ? "" : "s"} completed`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <header className="page-header">
        <div>
          <div className="section-tag">Overview</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {greeting}, {user.name.split(" ")[0]}. Here’s where every production stands.
          </p>
        </div>
        <div className="header-actions">
          {permissions.viewFinancials && currencies.length > 1 && (
            <div className="segmented" role="group" aria-label="Currency">
              {currencies.map((c) => (
                <button key={c} className={c === activeCurrency ? "active" : ""} onClick={() => setCurrency(c)}>{c}</button>
              ))}
            </div>
          )}
          {permissions.editProjects && (
            <Link href="/projects/new" className="btn btn-gold"><IconPlus /> New Project</Link>
          )}
        </div>
      </header>

      <div className="stats">
        <Stat label="Total Projects" value={stats.total} hint={`${stats.byStatus.cancelled} cancelled`} />
        <Stat label="Completed" value={stats.byStatus.completed} gold hint={stats.total ? `${Math.round((stats.byStatus.completed / stats.total) * 100)}% of all projects` : "—"} />
        <Stat label="Active" value={active} hint={`${stats.byStatus.in_progress} shooting · ${stats.byStatus.post_production} in post`} />
        <Stat label="On Hold" value={stats.byStatus.on_hold} hint="Waiting on client or schedule" />
      </div>

      {permissions.viewFinancials && (
        <div className="stats">
          <Stat label={`Total Charged (${activeCurrency})`} value={compactMoney(stats.charged, activeCurrency)} hint={money(stats.charged, activeCurrency)} />
          <Stat label="Collected" value={compactMoney(stats.collected, activeCurrency)} gold hint={stats.charged ? `${Math.round((stats.collected / stats.charged) * 100)}% of charged` : "—"} />
          <Stat label="Outstanding" value={compactMoney(stats.outstanding, activeCurrency)} hint={`${stats.outstandingList.length ? "Owed by clients" : "Nothing owed"}`} />
          <Stat label="Profit (Charged − Expenses)" value={compactMoney(stats.charged - stats.expenses, activeCurrency)} hint={`Expenses ${money(stats.expenses, activeCurrency)}`} />
        </div>
      )}

      <div className="grid-3">
        <section className="panel">
          <h2 className="panel-title">
            {permissions.viewFinancials ? `Payments Received (${activeCurrency})` : "Projects Completed"}
            <small>Last 12 months</small>
          </h2>
          <div className="bar-chart" role="img" aria-label={`Monthly ${permissions.viewFinancials ? "payments received" : "completed projects"} for the last 12 months`}>
            <div className="bar-chart-plot">
              <div className="bar-chart-grid"><div /><div /><div /><div /></div>
              {stats.months.map((m, i) => (
                <div
                  key={m.key}
                  className="bar-col"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${m.label} ${m.year}: ${fmtMonth(m.value)}`}
                >
                  <div className="bar" style={{ height: `${(m.value / maxMonth) * 100}%` }} />
                  {hover === i && (
                    <div className="chart-tooltip">
                      <span>{m.label} {m.year}</span>
                      <strong>{fmtMonth(m.value)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="bar-labels">{stats.months.map((m) => <span key={m.key}>{m.label}</span>)}</div>
          </div>
          <table className="sr-only">
            <tbody>{stats.months.map((m) => <tr key={m.key}><td>{m.label} {m.year}</td><td>{fmtMonth(m.value)}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h2 className="panel-title">By Status</h2>
          <div className="hbar-list">
            {PROJECT_STATUSES.map((s) => (
              <div key={s}>
                <div className="hbar-head">
                  <strong style={{ fontWeight: 500 }}>{STATUS_LABELS[s]}</strong>
                  <span>{stats.byStatus[s]}</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${stats.total ? (stats.byStatus[s] / stats.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={permissions.viewFinancials ? "grid-3" : ""} style={{ marginTop: "1.5rem" }}>
        <section className="panel">
          <h2 className="panel-title">
            Recently Updated
            <Link href="/projects" className="btn btn-ghost btn-sm">View all</Link>
          </h2>
          {projects.length === 0 ? (
            <div className="empty">
              <IconFilm size={36} />
              <h3>No projects yet</h3>
              <p>{permissions.editProjects ? "Add your first production to start tracking it." : "Projects shared with you will appear here."}</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="table">
                <tbody>
                  {projects.slice(0, 6).map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => router.push(`/projects/${p.id}`)}>
                      <td className="title-cell">
                        <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()}><strong>{p.title}</strong></Link>
                        <span>{p.code} · {p.clientName}</span>
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="muted num">{date(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {permissions.viewFinancials && (
          <section className="panel" style={{ marginTop: 0 }}>
            <h2 className="panel-title">Outstanding Balances</h2>
            {stats.outstandingList.length === 0 ? (
              <p style={{ color: "var(--text-grey)", fontSize: "0.9rem" }}>All {activeCurrency} invoices are settled. 🎉</p>
            ) : (
              <div className="money-rows">
                {stats.outstandingList.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="money-row" style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                      <PaymentBadge status={p.totals!.paymentStatus} />
                    </div>
                    <strong>{money(p.totals!.balance, p.currency)}</strong>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, hint, gold }: { label: string; value: React.ReactNode; hint?: string; gold?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${gold ? "gold" : ""}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
