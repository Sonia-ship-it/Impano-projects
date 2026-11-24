"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import GeometricPattern from "@/components/GeometricPattern";
import { Loading, PasswordInput } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup", { cache: "no-store" })
      .then((r) => r.json())
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
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Setup failed.");
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
          <input className="lock-input" placeholder="Full name" value={form.name} onChange={set("name")} required autoFocus disabled={loading} />
          <input className="lock-input" type="email" placeholder="Email address" autoComplete="email" value={form.email} onChange={set("email")} required disabled={loading} />
          <PasswordInput className="lock-input" placeholder="Password (min. 8 characters)" autoComplete="new-password" minLength={8} value={form.password} onChange={set("password")} required disabled={loading} />
          <PasswordInput className="lock-input" placeholder="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required disabled={loading} />
          <button type="submit" className="btn btn-gold btn-block" disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? <span className="spinner" /> : "Create Admin Account"}
          </button>
          {error && <div className="alert alert-error">⚠️ {error}</div>}
        </form>
      </div>
    </div>
  );
}
