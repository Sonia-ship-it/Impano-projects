"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "./AppShell";
import { api, useToast } from "./ui";
import { IconLock, IconTrash } from "./Icons";
import { computeTotals } from "@/lib/calc";
import { money } from "@/lib/format";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  STATUS_LABELS,
  type ProjectView,
} from "@/lib/types";

interface PaymentRow { id?: string; date: string; amount: string; method: string; reference: string }
interface ExpenseRow { id?: string; date: string; description: string; amount: string }

const today = () => new Date().toISOString().slice(0, 10);

export default function ProjectForm({ project }: { project?: ProjectView }) {
  const { permissions } = useSession();
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(project);

  const [f, setF] = useState({
    title: project?.title ?? "",
    category: project?.category ?? "",
    status: project?.status ?? "planned",
    description: project?.description ?? "",
    clientName: project?.clientName ?? "",
    clientCompany: project?.clientCompany ?? "",
    clientEmail: project?.clientEmail ?? "",
    clientPhone: project?.clientPhone ?? "",
    location: project?.location ?? "",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    projectLead: project?.projectLead ?? "",
    team: (project?.team ?? []).join(", "),
    deliverables: (project?.deliverables ?? []).join("\n"),
    deliveryLink: project?.deliveryLink ?? "",
    currency: project?.currency ?? "RWF",
    amountCharged: project?.amountCharged != null ? String(project.amountCharged) : "",
    notes: project?.notes ?? "",
  });
  const [payments, setPayments] = useState<PaymentRow[]>(
    (project?.payments ?? []).map((p) => ({ ...p, amount: String(p.amount) })),
  );
  const [expenses, setExpenses] = useState<ExpenseRow[]>(
    (project?.expenses ?? []).map((e) => ({ ...e, amount: String(e.amount) })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const parseNum = (s: string) => parseFloat(s.replace(/,/g, "")) || 0;
  const totals = computeTotals({
    amountCharged: parseNum(f.amountCharged),
    payments: payments.map((p) => ({ id: "", date: p.date, method: p.method, reference: p.reference, amount: parseNum(p.amount) })),
    expenses: expenses.map((e) => ({ id: "", date: e.date, description: e.description, amount: parseNum(e.amount) })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = {
      title: f.title,
      category: f.category,
      status: f.status,
      description: f.description,
      clientName: f.clientName,
      clientCompany: f.clientCompany,
      location: f.location,
      startDate: f.startDate,
      endDate: f.endDate,
      projectLead: f.projectLead,
      team: f.team,
      deliverables: f.deliverables,
      deliveryLink: f.deliveryLink,
    };
    if (permissions.viewClientContacts) Object.assign(body, { clientEmail: f.clientEmail, clientPhone: f.clientPhone });
    if (permissions.viewNotes) body.notes = f.notes;
    if (permissions.viewFinancials) Object.assign(body, { currency: f.currency, amountCharged: f.amountCharged, payments, expenses });

    try {
      const res = await api<{ project: ProjectView }>(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      toast(isEdit ? "Project updated." : `Project ${res.project.code} created.`, "success");
      router.push(`/projects/${res.project.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="alert alert-error" style={{ marginTop: 0, marginBottom: "1.5rem" }}>⚠️ {error}</div>}

      <section className="panel">
        <h2 className="panel-title">Project Details</h2>
        <div className="form-grid">
          <div className="field full">
            <label className="label" htmlFor="title">Project title <span className="req">*</span></label>
            <input id="title" className="input" value={f.title} onChange={set("title")} placeholder="e.g. Echoes of the Hills — Feature Film" required maxLength={200} />
          </div>
          <div className="field">
            <label className="label" htmlFor="category">Category</label>
            <select id="category" className="select" value={f.category} onChange={set("category")}>
              <option value="">Select category…</option>
              {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              {f.category && !(PROJECT_CATEGORIES as readonly string[]).includes(f.category) && <option value={f.category}>{f.category}</option>}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="status">Status <span className="req">*</span></label>
            <select id="status" className="select" value={f.status} onChange={set("status")}>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="startDate">Start date</label>
            <input id="startDate" type="date" className="input" value={f.startDate} onChange={set("startDate")} />
          </div>
          <div className="field">
            <label className="label" htmlFor="endDate">End / delivery date</label>
            <input id="endDate" type="date" className="input" value={f.endDate} onChange={set("endDate")} min={f.startDate || undefined} />
          </div>
          <div className="field">
            <label className="label" htmlFor="location">Location</label>
            <input id="location" className="input" value={f.location} onChange={set("location")} placeholder="e.g. Kigali, Rwanda" />
          </div>
          <div className="field">
            <label className="label" htmlFor="projectLead">Project lead / director</label>
            <input id="projectLead" className="input" value={f.projectLead} onChange={set("projectLead")} />
          </div>
          <div className="field full">
            <label className="label" htmlFor="team">Crew / team members</label>
            <input id="team" className="input" value={f.team} onChange={set("team")} placeholder="Separate names with commas" />
          </div>
          <div className="field full">
            <label className="label" htmlFor="description">Description / scope of work</label>
            <textarea id="description" className="textarea" value={f.description} onChange={set("description")} placeholder="What was produced, for what purpose, key details…" />
          </div>
          <div className="field">
            <label className="label" htmlFor="deliverables">Deliverables</label>
            <textarea id="deliverables" className="textarea" value={f.deliverables} onChange={set("deliverables")} placeholder={"One per line, e.g.\n1× 60s TV commercial\n3× 15s social cut-downs"} />
          </div>
          <div className="field">
            <label className="label" htmlFor="deliveryLink">Final delivery link</label>
            <input id="deliveryLink" type="url" className="input" value={f.deliveryLink} onChange={set("deliveryLink")} placeholder="https://drive.google.com/…" />
            <span className="field-hint">Drive / Frame.io / YouTube link to the delivered files.</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Client</h2>
        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="clientName">Client name <span className="req">*</span></label>
            <input id="clientName" className="input" value={f.clientName} onChange={set("clientName")} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="clientCompany">Company / organisation</label>
            <input id="clientCompany" className="input" value={f.clientCompany} onChange={set("clientCompany")} />
          </div>
          {permissions.viewClientContacts ? (
            <>
              <div className="field">
                <label className="label" htmlFor="clientEmail">Email</label>
                <input id="clientEmail" type="email" className="input" value={f.clientEmail} onChange={set("clientEmail")} />
              </div>
              <div className="field">
                <label className="label" htmlFor="clientPhone">Phone</label>
                <input id="clientPhone" type="tel" className="input" value={f.clientPhone} onChange={set("clientPhone")} placeholder="+250 7xx xxx xxx" />
              </div>
            </>
          ) : (
            <div className="restricted full"><IconLock /> Client contact details are restricted by the administrator.</div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">Financials</h2>
        {permissions.viewFinancials ? (
          <>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="currency">Currency</label>
                <select id="currency" className="select" value={f.currency} onChange={set("currency")}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="amountCharged">Amount charged (contract value)</label>
                <input id="amountCharged" inputMode="decimal" className="input" value={f.amountCharged} onChange={set("amountCharged")} placeholder="0" />
              </div>
            </div>

            <h3 className="label" style={{ margin: "2rem 0 0.75rem" }}>Payments received</h3>
            <div className="line-items">
              {payments.map((p, i) => (
                <div key={p.id ?? `new-${i}`} className="line-item payment">
                  <div className="field">
                    <label className="label" htmlFor={`pd-${i}`}>Date</label>
                    <input id={`pd-${i}`} type="date" className="input" value={p.date} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`pa-${i}`}>Amount ({f.currency})</label>
                    <input id={`pa-${i}`} inputMode="decimal" className="input" value={p.amount} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`pm-${i}`}>Method</label>
                    <select id={`pm-${i}`} className="select" value={p.method} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))}>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`pr-${i}`}>Reference / note</label>
                    <input id={`pr-${i}`} className="input" value={p.reference} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} placeholder="Invoice #, transaction ID…" />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm line-remove" onClick={() => setPayments(payments.filter((_, j) => j !== i))} aria-label="Remove payment"><IconTrash size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn-dashed" onClick={() => setPayments([...payments, { date: today(), amount: "", method: "Bank Transfer", reference: "" }])}>+ Record payment</button>
            </div>

            <h3 className="label" style={{ margin: "2rem 0 0.75rem" }}>Production expenses</h3>
            <div className="line-items">
              {expenses.map((x, i) => (
                <div key={x.id ?? `new-${i}`} className="line-item expense">
                  <div className="field">
                    <label className="label" htmlFor={`ed-${i}`}>Date</label>
                    <input id={`ed-${i}`} type="date" className="input" value={x.date} onChange={(e) => setExpenses(expenses.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`edesc-${i}`}>Description</label>
                    <input id={`edesc-${i}`} className="input" value={x.description} onChange={(e) => setExpenses(expenses.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} placeholder="Equipment rental, crew fees, transport…" />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor={`ea-${i}`}>Amount ({f.currency})</label>
                    <input id={`ea-${i}`} inputMode="decimal" className="input" value={x.amount} onChange={(e) => setExpenses(expenses.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                  </div>
                  <button type="button" className="btn btn-danger btn-sm line-remove" onClick={() => setExpenses(expenses.filter((_, j) => j !== i))} aria-label="Remove expense"><IconTrash size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn-dashed" onClick={() => setExpenses([...expenses, { date: today(), description: "", amount: "" }])}>+ Add expense</button>
            </div>

            <div className="totals-bar">
              <div><span>Charged</span><strong>{money(parseNum(f.amountCharged), f.currency)}</strong></div>
              <div><span>Paid</span><strong>{money(totals.amountPaid, f.currency)}</strong></div>
              <div><span>Balance</span><strong style={{ color: totals.balance > 0 ? "var(--warning)" : "var(--success)" }}>{money(totals.balance, f.currency)}</strong></div>
              <div><span>Expenses</span><strong>{money(totals.totalExpenses, f.currency)}</strong></div>
              <div><span>Profit</span><strong>{money(totals.profit, f.currency)}</strong></div>
            </div>
          </>
        ) : (
          <div className="restricted"><IconLock /> Financial information is restricted by the administrator.</div>
        )}
      </section>

      {permissions.viewNotes && (
        <section className="panel">
          <h2 className="panel-title">Internal Notes</h2>
          <textarea className="textarea" value={f.notes} onChange={set("notes")} placeholder="Private notes — visible only to people allowed to see notes." aria-label="Internal notes" />
        </section>
      )}

      <div className="form-actions">
        <Link href={isEdit ? `/projects/${project!.id}` : "/projects"} className="btn btn-ghost">Cancel</Link>
        <button type="submit" className="btn btn-gold" disabled={saving}>
          {saving ? <span className="spinner" /> : isEdit ? "Save Changes" : "Create Project"}
        </button>
      </div>
    </form>
  );
}
