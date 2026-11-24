"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/AppShell";
import { api, Loading, PaymentBadge, StatusBadge } from "@/components/ui";
import { IconDownload, IconFilm, IconPlus, IconSearch, IconSort } from "@/components/Icons";
import { date, money } from "@/lib/format";
import { PROJECT_CATEGORIES, PROJECT_STATUSES, STATUS_LABELS, type ProjectView } from "@/lib/types";
import { PAYMENT_STATUS_LABELS } from "@/lib/format";

type SortKey = "code" | "title" | "client" | "status" | "endDate" | "amount" | "balance" | "updatedAt";

export default function ProjectsPage() {
  const { permissions } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectView[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [payment, setPayment] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updatedAt", dir: -1 });

  useEffect(() => {
    api<{ projects: ProjectView[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
  }, []);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects ?? []) {
      const y = (p.endDate || p.startDate || p.createdAt).slice(0, 4);
      if (y) set.add(y);
    }
    return [...set].sort().reverse();
  }, [projects]);

  const categories = useMemo(() => {
    const set = new Set<string>(PROJECT_CATEGORIES);
    for (const p of projects ?? []) if (p.category) set.add(p.category);
    return [...set];
  }, [projects]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (projects ?? []).filter((p) => {
      if (status && p.status !== status) return false;
      if (category && p.category !== category) return false;
      if (payment && p.totals?.paymentStatus !== payment) return false;
      if (year && (p.endDate || p.startDate || p.createdAt).slice(0, 4) !== year) return false;
      if (!term) return true;
      return [p.title, p.code, p.clientName, p.clientCompany, p.category, p.location, p.projectLead, ...(p.team ?? [])]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
    const val = (p: ProjectView): string | number => {
      switch (sort.key) {
        case "code": return p.code;
        case "title": return p.title.toLowerCase();
        case "client": return p.clientName?.toLowerCase() ?? "";
        case "status": return PROJECT_STATUSES.indexOf(p.status);
        case "endDate": return p.endDate || "";
        case "amount": return p.amountCharged ?? 0;
        case "balance": return p.totals?.balance ?? 0;
        default: return p.updatedAt;
      }
    };
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [projects, q, status, category, payment, year, sort]);

  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, { charged: number; paid: number; balance: number }>();
    for (const p of filtered) {
      if (!p.currency || !p.totals) continue;
      const t = m.get(p.currency) ?? { charged: 0, paid: 0, balance: 0 };
      t.charged += p.amountCharged ?? 0;
      t.paid += p.totals.amountPaid;
      t.balance += Math.max(0, p.totals.balance);
      m.set(p.currency, t);
    }
    return [...m.entries()];
  }, [filtered]);

  const th = (k: SortKey, children: React.ReactNode, num?: boolean) => (
    <th key={k} className={num ? "num" : ""} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className={sort.key === k ? "sorted" : ""} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : 1 }))}>
        {children} <IconSort />
      </button>
    </th>
  );

  const hasFilters = q || status || category || payment || year;

  return (
    <>
      <header className="page-header">
        <div>
          <div className="section-tag">Portfolio</div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">Every production — who it was for, where it stands{permissions.viewFinancials ? ", and what it earned" : ""}.</p>
        </div>
        <div className="header-actions">
          {permissions.exportData && (
            <a href="/api/projects/export" className="btn btn-ghost" download><IconDownload /> Export CSV</a>
          )}
          {permissions.editProjects && (
            <Link href="/projects/new" className="btn btn-gold"><IconPlus /> New Project</Link>
          )}
        </div>
      </header>

      <div className="toolbar">
        <div className="search">
          <IconSearch />
          <input className="input" placeholder="Search title, client, code, team…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        </div>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {permissions.viewFinancials && (
          <select className="select" value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Filter by payment">
            <option value="">All payments</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <select className="select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setStatus(""); setCategory(""); setPayment(""); setYear(""); }}>Clear</button>
        )}
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {!projects && !error && <Loading label="Loading projects…" />}

      {projects && (
        <>
          <div className="result-count">
            Showing {filtered.length} of {projects.length} project{projects.length === 1 ? "" : "s"}
            {permissions.viewFinancials && totalsByCurrency.map(([c, t]) => (
              <span key={c}> · <strong style={{ color: "#fff" }}>{money(t.charged, c)}</strong> charged, {money(t.paid, c)} collected, {money(t.balance, c)} outstanding</span>
            ))}
          </div>
          <div className="table-wrap">
            {filtered.length === 0 ? (
              <div className="empty">
                <IconFilm size={36} />
                <h3>{projects.length === 0 ? "No projects yet" : "No matching projects"}</h3>
                <p>{projects.length === 0 ? (permissions.editProjects ? "Click “New Project” to record your first production." : "Nothing has been shared with you yet.") : "Try a different search or clear the filters."}</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    {th("code", "Code")}
                    {th("title", "Project")}
                    {th("client", "Client")}
                    {th("status", "Status")}
                    {th("endDate", "Delivery")}
                    {permissions.viewFinancials && th("amount", "Charged", true)}
                    {permissions.viewFinancials && th("balance", "Balance", true)}
                    {permissions.viewFinancials && <th>Payment</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="clickable" onClick={() => router.push(`/projects/${p.id}`)}>
                      <td className="code">{p.code}</td>
                      <td className="title-cell">
                        <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()}><strong>{p.title}</strong></Link>
                        <span>{p.category || "—"}</span>
                      </td>
                      <td>
                        {p.clientName}
                        {p.clientCompany && <div className="muted">{p.clientCompany}</div>}
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="muted">{date(p.endDate)}</td>
                      {permissions.viewFinancials && <td className="num">{money(p.amountCharged, p.currency)}</td>}
                      {permissions.viewFinancials && <td className="num">{money(p.totals?.balance, p.currency)}</td>}
                      {permissions.viewFinancials && <td>{p.totals && <PaymentBadge status={p.totals.paymentStatus} />}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
