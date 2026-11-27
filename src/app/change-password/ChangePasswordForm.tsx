"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import GeometricPattern from "@/components/GeometricPattern";
import { api, PasswordChecklist, passwordChecks, PasswordInput } from "@/components/ui";
import { IconKey } from "@/components/Icons";

export default function ChangePasswordForm({ name, email, tempPassword }: { name: string; email: string; tempPassword: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const checks = passwordChecks(pw, confirm, tempPassword);
  const valid = checks.every((c) => c.ok);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/password", { method: "POST", body: JSON.stringify({ newPassword: pw }) });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  return (
    <div className="lock-wrapper">
      <GeometricPattern />
      <div className="lock-screen">
        <form className="lock-card" onSubmit={submit} noValidate>
          <div className="lock-logo"><Logo size={64} /></div>
          <div className="lock-icon-badge"><IconKey size={18} /></div>
          <h1 className="lock-title">Set your <span>password</span></h1>
          <p className="lock-desc">
            Welcome, {name}. You signed in with the temporary password, so choose your own before continuing.
          </p>

          <div className="lock-fields">
            <input type="email" value={email} autoComplete="username" readOnly hidden />
            <label className="lock-label" htmlFor="np">New password</label>
            <PasswordInput id="np" className="lock-input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus disabled={loading} />
            <label className="lock-label" htmlFor="cp">Confirm new password</label>
            <PasswordInput id="cp" className="lock-input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} />
            <PasswordChecklist checks={checks} />
          </div>

          <button type="submit" className="btn btn-gold btn-block" disabled={loading || !valid}>
            {loading ? <span className="spinner" /> : "Save & Continue"}
          </button>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button type="button" className="lock-link" onClick={signOut}>Sign out</button>
        </form>
      </div>
    </div>
  );
}
