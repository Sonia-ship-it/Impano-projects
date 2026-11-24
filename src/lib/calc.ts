import type { PaymentStatus, Project } from "./types";

/** Pure helpers shared by server and client (no server-only imports here). */

export function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeTotals(p: Pick<Project, "amountCharged" | "payments" | "expenses">) {
  const amountPaid = round(p.payments.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const totalExpenses = round(p.expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const charged = Number(p.amountCharged) || 0;
  const balance = round(charged - amountPaid);
  let paymentStatus: PaymentStatus = "unpaid";
  if (amountPaid > 0 && balance > 0) paymentStatus = "partial";
  if (amountPaid > 0 && balance === 0) paymentStatus = "paid";
  if (balance < 0) paymentStatus = "overpaid";
  return { amountPaid, balance, totalExpenses, profit: round(charged - totalExpenses), paymentStatus };
}
