import type {
  ActivityEntry,
  Currency,
  Database,
  Expense,
  Payment,
  Project,
  ProjectStatus,
  ProjectView,
  User,
} from "./types";
import { CURRENCIES, PROJECT_STATUSES } from "./types";
import { effectivePermissions } from "./auth";
import { newId } from "./db";
import { computeTotals, round } from "./calc";

export { computeTotals };

/* ---------------- Access control ---------------- */

export function canAccessProject(user: User, projectId: string) {
  if (user.role === "admin") return true;
  return user.projectAccess.mode === "all" || user.projectAccess.projectIds.includes(projectId);
}

export function visibleProjects(user: User, db: Database) {
  return db.projects.filter((p) => canAccessProject(user, p.id));
}

/** Strip whatever the user is not allowed to see. This is the single source of truth for read access. */
export function toView(project: Project, user: User): ProjectView {
  const perms = effectivePermissions(user);
  const view: ProjectView = { ...project };
  if (perms.viewFinancials) {
    view.totals = computeTotals(project);
  } else {
    delete view.amountCharged;
    delete view.payments;
    delete view.expenses;
  }
  if (!perms.viewClientContacts) {
    delete view.clientEmail;
    delete view.clientPhone;
  }
  if (!perms.viewNotes) delete view.notes;
  return view;
}

/* ---------------- Input validation ---------------- */

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dateStr = (v: unknown) => {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : "";
};
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? round(n) : NaN;
};
const list = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(/\n|,/) : [])
    .map((x) => str(x, 200))
    .filter(Boolean)
    .slice(0, 100);

type Input = Record<string, unknown>;
export type ValidationResult = { ok: true; data: Partial<Project> } | { ok: false; error: string };

/**
 * Validate a create/update payload. Fields the user cannot see are ignored entirely,
 * so a restricted editor can never overwrite (or blank out) financials, contacts or notes.
 */
export function parseProjectInput(body: Input, user: User, isCreate: boolean): ValidationResult {
  const perms = effectivePermissions(user);
  const data: Partial<Project> = {};

  const title = str(body.title, 200);
  if (isCreate || "title" in body) {
    if (!title) return { ok: false, error: "Project title is required." };
    data.title = title;
  }
  if (isCreate || "clientName" in body) {
    const clientName = str(body.clientName, 200);
    if (!clientName) return { ok: false, error: "Client name is required." };
    data.clientName = clientName;
  }
  if (isCreate || "status" in body) {
    const status = str(body.status) as ProjectStatus;
    if (!PROJECT_STATUSES.includes(status)) return { ok: false, error: "Invalid project status." };
    data.status = status;
  }

  for (const key of ["category", "clientCompany", "location", "projectLead", "deliveryLink"] as const) {
    if (isCreate || key in body) data[key] = str(body[key], 300);
  }
  if (isCreate || "description" in body) data.description = str(body.description, 5000);
  if (isCreate || "startDate" in body) data.startDate = dateStr(body.startDate);
  if (isCreate || "endDate" in body) data.endDate = dateStr(body.endDate);
  if (data.startDate && data.endDate && data.endDate < data.startDate)
    return { ok: false, error: "End / delivery date cannot be before the start date." };
  if (data.deliveryLink && !/^https?:\/\//i.test(data.deliveryLink))
    return { ok: false, error: "Delivery link must start with http:// or https://" };
  if (isCreate || "team" in body) data.team = list(body.team);
  if (isCreate || "deliverables" in body) data.deliverables = list(body.deliverables);

  if (perms.viewClientContacts) {
    if (isCreate || "clientEmail" in body) {
      const email = str(body.clientEmail, 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Client email is invalid." };
      data.clientEmail = email;
    }
    if (isCreate || "clientPhone" in body) data.clientPhone = str(body.clientPhone, 50);
  } else if (isCreate) {
    data.clientEmail = "";
    data.clientPhone = "";
  }

  if (perms.viewNotes) {
    if (isCreate || "notes" in body) data.notes = str(body.notes, 10000);
  } else if (isCreate) data.notes = "";

  if (perms.viewFinancials) {
    if (isCreate || "currency" in body) {
      const currency = str(body.currency) as Currency;
      data.currency = CURRENCIES.includes(currency) ? currency : "RWF";
    }
    if (isCreate || "amountCharged" in body) {
      const amount = body.amountCharged === "" || body.amountCharged == null ? 0 : num(body.amountCharged);
      if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Amount charged must be a positive number." };
      data.amountCharged = amount;
    }
    if (isCreate || "payments" in body) {
      const payments: Payment[] = [];
      for (const raw of Array.isArray(body.payments) ? (body.payments as Input[]) : []) {
        const amount = num(raw.amount);
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Each payment needs an amount greater than 0." };
        payments.push({
          id: str(raw.id, 40) || newId("pay_"),
          date: dateStr(raw.date),
          amount,
          method: str(raw.method, 50),
          reference: str(raw.reference, 200),
        });
      }
      data.payments = payments;
    }
    if (isCreate || "expenses" in body) {
      const expenses: Expense[] = [];
      for (const raw of Array.isArray(body.expenses) ? (body.expenses as Input[]) : []) {
        const amount = num(raw.amount);
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Each expense needs an amount greater than 0." };
        const description = str(raw.description, 300);
        if (!description) return { ok: false, error: "Each expense needs a description." };
        expenses.push({ id: str(raw.id, 40) || newId("exp_"), date: dateStr(raw.date), description, amount });
      }
      data.expenses = expenses;
    }
  } else if (isCreate) {
    data.currency = "RWF";
    data.amountCharged = 0;
    data.payments = [];
    data.expenses = [];
  }

  return { ok: true, data };
}

export function nextProjectCode(db: Database) {
  const year = new Date().getFullYear().toString();
  const seq = (db.meta.projectSeq[year] ?? 0) + 1;
  db.meta.projectSeq[year] = seq;
  return `IMP-${year}-${String(seq).padStart(3, "0")}`;
}

/* ---------------- Activity log ---------------- */

export function logActivity(db: Database, user: Pick<User, "id" | "name">, action: string, target: string, details?: string) {
  const entry: ActivityEntry = { id: newId("act_"), at: new Date().toISOString(), userId: user.id, userName: user.name, action, target, details };
  db.activity.unshift(entry);
  if (db.activity.length > 2000) db.activity.length = 2000;
}
