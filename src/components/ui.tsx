"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IconAlert, IconCheck, IconEye, IconEyeOff } from "./Icons";
import { STATUS_LABELS, type PaymentStatus, type ProjectStatus } from "@/lib/types";
import { PAYMENT_STATUS_LABELS } from "@/lib/format";

/* ---------------- Toasts ---------------- */

type ToastType = "success" | "error" | "info";
const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const show = useCallback((message: string, type: ToastType = "info") => setToast({ message, type, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div key={toast.key} className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          {toast.type === "error" ? <IconAlert /> : <IconCheck />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------- Badges ---------------- */

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge badge-${status}`}>{PAYMENT_STATUS_LABELS[status]}</span>;
}

/* ---------------- Password input ---------------- */

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

/** Live checklist shown under "new password" fields; mirrors the server rules in lib/passwords. */
export function passwordChecks(pw: string, confirm: string, tempPassword?: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Contains a letter and a number" },
    ...(tempPassword ? [{ ok: pw.length > 0 && pw !== tempPassword, label: "Not the temporary password" }] : []),
    { ok: pw.length > 0 && pw === confirm, label: "Both passwords match" },
  ];
}

export function PasswordChecklist({ checks }: { checks: { ok: boolean; label: string }[] }) {
  return (
    <ul className="pw-checks" aria-label="Password requirements">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "ok" : ""}>
          <span className="pw-check-dot" aria-hidden="true">{c.ok ? <IconCheck size={11} /> : null}</span>
          {c.label}
          <span className="sr-only">{c.ok ? " (done)" : " (not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  title,
  onClose,
  children,
  small,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${small ? "modal-sm" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} small>
      <p>{message}</p>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-danger-solid" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-screen">
      <span className="spinner spinner-gold" />
      <span>{label}</span>
    </div>
  );
}

/* ---------------- Fetch helper ---------------- */

export async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    window.location.href = "/login";
  }
  if (res.status === 403 && data.code === "password_change_required" && typeof window !== "undefined") {
    window.location.href = "/change-password";
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
