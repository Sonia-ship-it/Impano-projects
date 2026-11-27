"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import GeometricPattern from "@/components/GeometricPattern";
import { api, Loading, PasswordChecklist, passwordChecks, PasswordInput } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/setup")
      .then((d) => (d.needsSetup ? setChecking(false) : router.replace("/login")))
      .catch(() => setChecking(false));
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setLoading(true);
    setError("");
    try {
      await api("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  if (checking) return <div className="lock-wrapper"><Loading /></div>;

  return (
    <div className="lock-wrapper">
      <GeometricPattern />
      <div className="lock-screen">
        <form className="lock-card" onSubmit={submit}>
          <div className="lock-logo">
            <Logo size={64} />
          </div>
          <span className="badge badge-gold no-dot" style={{ marginBottom: "1rem" }}>First-time setup</span>
          <h1 className="lock-title">
            Create <span>Admin</span>
          </h1>
          <p className="lock-desc">This account will have full control: projects, finances, users and permissions.</p>
          <div className="lock-fields">
            <label className="lock-label" htmlFor="s-name">Full name</label>
            <input id="s-name" className="lock-input" value={form.name} onChange={set("name")} required autoFocus disabled={loading} />
            <label className="lock-label" htmlFor="s-email">Email</label>
            <input id="s-email" className="lock-input" type="email" autoComplete="email" value={form.email} onChange={set("email")} required disabled={loading} />
            <label className="lock-label" htmlFor="s-pw">Password</label>
            <PasswordInput id="s-pw" className="lock-input" autoComplete="new-password" value={form.password} onChange={set("password")} required disabled={loading} />
            <label className="lock-label" htmlFor="s-cp">Confirm password</label>
            <PasswordInput id="s-cp" className="lock-input" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required disabled={loading} />
            <PasswordChecklist checks={passwordChecks(form.password, form.confirm)} />
          </div>
          <button type="submit" className="btn btn-gold btn-block" disabled={loading || !passwordChecks(form.password, form.confirm).every((c) => c.ok)}>
            {loading ? <span className="spinner" /> : "Create Admin Account"}
          </button>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
        </form>
      </div>
    </div>
  );
}
