"use client";

import { useState } from "react";
import { useSession } from "@/components/AppShell";
import { api, PasswordChecklist, passwordChecks, PasswordInput, useToast } from "@/components/ui";
import { IconCheck, IconLock } from "@/components/Icons";
import { PERMISSION_LABELS, type Permissions } from "@/lib/types";

export default function AccountPage() {
  const { user, permissions, isAdmin } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.newPassword !== form.confirm) return setError("New passwords do not match.");
    setSaving(true);
    try {
      await api("/api/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      toast("Password changed. Other sessions have been signed out.", "success");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <div>
          <div className="section-tag">Profile</div>
          <h1 className="page-title">My Account</h1>
          <p className="page-sub">{user.name} · {user.email}</p>
        </div>
      </header>

      <div className="grid-2">
        <section className="panel">
          <h2 className="panel-title">Your Access <span className={`badge ${isAdmin ? "badge-gold" : "badge-muted"} no-dot`}>{isAdmin ? "Administrator" : "Member"}</span></h2>
          {isAdmin ? (
            <p style={{ color: "var(--text-soft)" }}>You have full control over projects, financial records, users and permissions.</p>
          ) : (
            <>
              <p style={{ color: "var(--text-grey)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Set by the administrator. Projects: <strong style={{ color: "#fff" }}>{user.projectAccess.mode === "all" ? "all projects" : `${user.projectAccess.projectIds.length} selected`}</strong>.
              </p>
              {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((k) => (
                <div key={k} className="switch-row" style={{ alignItems: "center" }}>
                  <div><strong>{PERMISSION_LABELS[k].label}</strong><small>{PERMISSION_LABELS[k].hint}</small></div>
                  {permissions[k] ? (
                    <span className="badge badge-completed no-dot"><IconCheck size={12} /> Allowed</span>
                  ) : (
                    <span className="badge badge-muted no-dot"><IconLock size={12} /> Restricted</span>
                  )}
                </div>
              ))}
            </>
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">Change Password</h2>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <div className="field">
              <label className="label" htmlFor="cur">Current password</label>
              <PasswordInput id="cur" className="input" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="np">New password</label>
              <PasswordInput id="np" className="input" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="cp">Confirm new password</label>
              <PasswordInput id="cp" className="input" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </div>
            <PasswordChecklist checks={passwordChecks(form.newPassword, form.confirm)} />
            {error && <div className="alert alert-error" style={{ marginTop: 0 }} role="alert">{error}</div>}
            <div><button type="submit" className="btn btn-gold" disabled={saving || !passwordChecks(form.newPassword, form.confirm).every((c) => c.ok) || !form.currentPassword}>{saving ? <span className="spinner" /> : "Update Password"}</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
