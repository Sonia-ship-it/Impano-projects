import type { PaymentStatus } from "./types";

export function money(amount: number | undefined, currency = "RWF") {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const digits = currency === "RWF" ? 0 : 2;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function compactMoney(amount: number, currency = "RWF") {
  const abs = Math.abs(amount);
  const fmt = (n: number, s: string) => `${currency} ${(n).toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "")}${s}`;
  if (abs >= 1e9) return fmt(amount / 1e9, "B");
  if (abs >= 1e6) return fmt(amount / 1e6, "M");
  if (abs >= 1e3) return fmt(amount / 1e3, "K");
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function date(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overpaid: "Overpaid",
};
