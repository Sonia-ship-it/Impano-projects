"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import GeometricPattern from "@/components/GeometricPattern";
import { api, PasswordInput } from "@/components/ui";
import { IconArrowLeft, IconMail } from "@/components/Icons";

const RESEND_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ needsSetup: boolean }>("/api/auth/setup")
      .then((d) => d.needsSetup && router.replace("/setup"))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const d = await api<{ email: string; devCode?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setMaskedEmail(d.email);
      setDevCode(d.devCode ?? "");
      setCode("");
      setNotice("");
      setStep("code");
      setCooldown(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return;
    setLoading(true);
    setError("");
    try {
      const d = await api<{ mustChangePassword: boolean }>("/api/auth/otp", { method: "POST", body: JSON.stringify({ code: value }) });
      router.replace(d.mustChangePassword ? "/change-password" : "/dashboard");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setCode("");
      setLoading(false);
      if (/sign in again|expired/i.test(msg)) {
        setStep("password");
        setPassword("");
      } else {
        codeRef.current?.focus();
      }
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    try {
      const d = await api<{ devCode?: string }>("/api/auth/otp/resend", { method: "POST" });
      setDevCode(d.devCode ?? "");
      setNotice("A new code is on its way.");
      setCooldown(RESEND_SECONDS);
      codeRef.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const back = () => {
    setStep("password");
    setPassword("");
    setError("");
    setNotice("");
  };

  return (
    <div className="lock-wrapper">
      <GeometricPattern />
      <div className="lock-screen">
        {step === "password" ? (
          <form className="lock-card" onSubmit={submitPassword}>
            <div className="lock-logo"><Logo size={76} /></div>
            <h1 className="lock-title">Impano <span>Projects</span></h1>
            <p className="lock-desc">Sign in to track productions, clients and payments.</p>

            <div className="lock-fields">
              <label className="lock-label" htmlFor="email">Email</label>
              <input
                id="email"
                className="lock-input"
                type="email"
                placeholder="you@impanoent.com"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
              <label className="lock-label" htmlFor="password">Password</label>
              <PasswordInput
                id="password"
                className="lock-input"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-gold btn-block" disabled={loading || !email || !password}>
              {loading ? <span className="spinner" /> : "Continue"}
            </button>

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <p className="lock-foot">Accounts are created by the studio administrator.</p>
          </form>
        ) : (
          <form className="lock-card" onSubmit={(e) => { e.preventDefault(); verify(code); }}>
            <button type="button" className="lock-back" onClick={back}><IconArrowLeft /> Back</button>
            <div className="lock-icon-badge lg"><IconMail size={24} /></div>
            <h1 className="lock-title">Check your <span>email</span></h1>
            <p className="lock-desc">
              We sent a 6-digit code to <strong className="text-white">{maskedEmail}</strong>. It expires in 10 minutes.
            </p>

            <label className="sr-only" htmlFor="otp">Sign-in code</label>
            <input
              id="otp"
              ref={codeRef}
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
            />
            {devCode && (
              <div className="alert alert-info">Development mode (no email service configured): your code is <strong>{devCode}</strong></div>
            )}

            <button type="submit" className="btn btn-gold btn-block" disabled={loading || code.length !== 6}>
              {loading ? <span className="spinner" /> : "Verify & Sign In"}
            </button>

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {notice && !error && <div className="alert alert-info" role="status">{notice}</div>}

            <p className="lock-foot">
              Didn’t get it? Check spam, or{" "}
              {cooldown > 0 ? (
                <span>resend in {cooldown}s</span>
              ) : (
                <button type="button" className="lock-link inline" onClick={resend}>send a new code</button>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
