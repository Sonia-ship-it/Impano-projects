export type Role = "admin" | "member";

export interface Permissions {
  /** See amount charged, payments, expenses, balances and revenue totals. */
  viewFinancials: boolean;
  /** See client email / phone. */
  viewClientContacts: boolean;
  /** See internal notes on projects. */
  viewNotes: boolean;
  /** Create and edit projects (delete is always admin-only). */
  editProjects: boolean;
  /** Download project lists as CSV. */
  exportData: boolean;
}

export interface ProjectAccess {
  mode: "all" | "selected";
  projectIds: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  permissions: Permissions;
  projectAccess: ProjectAccess;
  active: boolean;
  sessionVersion: number;
  createdAt: string;
  lastLoginAt?: string;
}

export type PublicUser = Omit<User, "passwordHash" | "sessionVersion">;

export const PROJECT_STATUSES = [
  "planned",
  "in_progress",
  "post_production",
  "completed",
  "on_hold",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planned",
  in_progress: "In Production",
  post_production: "Post-Production",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export const PROJECT_CATEGORIES = [
  "Film Production",
  "Music Video",
  "Commercial / Advert",
  "Documentary",
  "Corporate Video",
  "Event Coverage",
  "Photography",
  "Post-Production",
  "Color Grading",
  "Animation / VFX",
  "Other",
] as const;

export const CURRENCIES = ["RWF", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_METHODS = ["Bank Transfer", "Mobile Money", "Cash", "Card", "Cheque", "Other"] as const;

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface Project {
  id: string;
  code: string;
  title: string;
  category: string;
  status: ProjectStatus;
  description: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  location: string;
  startDate: string;
  endDate: string;
  projectLead: string;
  team: string[];
  deliverables: string[];
  deliveryLink: string;
  currency: Currency;
  amountCharged: number;
  payments: Payment[];
  expenses: Expense[];
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details?: string;
}

export interface Database {
  version: 1;
  meta: { sessionSecret: string; projectSeq: Record<string, number> };
  users: User[];
  projects: Project[];
  activity: ActivityEntry[];
}

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

/** What the API returns: financial / contact / note fields are omitted when not permitted. */
export type ProjectView = Partial<Project> &
  Pick<Project, "id" | "code" | "title" | "status" | "category" | "createdAt" | "updatedAt"> & {
    totals?: {
      amountPaid: number;
      balance: number;
      totalExpenses: number;
      profit: number;
      paymentStatus: PaymentStatus;
    };
  };

export const FULL_PERMISSIONS: Permissions = {
  viewFinancials: true,
  viewClientContacts: true,
  viewNotes: true,
  editProjects: true,
  exportData: true,
};

export const DEFAULT_MEMBER_PERMISSIONS: Permissions = {
  viewFinancials: false,
  viewClientContacts: false,
  viewNotes: false,
  editProjects: false,
  exportData: false,
};

export const PERMISSION_LABELS: Record<keyof Permissions, { label: string; hint: string }> = {
  viewFinancials: { label: "View financials", hint: "Amount charged, payments, expenses, balances & revenue" },
  viewClientContacts: { label: "View client contacts", hint: "Client email and phone number" },
  viewNotes: { label: "View internal notes", hint: "Private notes written on projects" },
  editProjects: { label: "Create & edit projects", hint: "Add new projects and update existing ones (no delete)" },
  exportData: { label: "Export CSV", hint: "Download the project list as a spreadsheet" },
};
