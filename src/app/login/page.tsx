"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import GeometricPattern from "@/components/GeometricPattern";
import { PasswordInput } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.needsSetup && router.replace("/setup"))
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed.");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="lock-wrapper">
      <GeometricPattern />
      <div className="lock-screen">
        <form className="lock-card" onSubmit={submit}>
          <div className="lock-logo">
            <Logo size={72} />
          </div>
          <h1 className="lock-title">
            Impano <span>Projects</span>
          </h1>
          <p className="lock-desc">Sign in to track productions, clients and payments.</p>

          <input
            className="lock-input"
            type="email"
            placeholder="Email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={loading}
          />
          <PasswordInput
            className="lock-input"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" className="btn btn-gold btn-block" disabled={loading || !email || !password} style={{ marginTop: "0.5rem" }}>
            {loading ? <span className="spinner" /> : "Sign In ➔"}
          </button>

          {error && <div className="alert alert-error">⚠️ {error}</div>}
          <p style={{ marginTop: "1.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Accounts are created by the studio administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
