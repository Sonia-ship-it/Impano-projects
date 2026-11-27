/**
 * Outgoing email (sign-in codes, welcome emails, password resets).
 *
 * Configure ONE of these in the environment (Vercel → Settings → Environment Variables):
 *  - Resend:  RESEND_API_KEY  (+ MAIL_FROM using a domain verified in Resend)
 *  - SMTP:    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (+ MAIL_FROM)
 *             e.g. Gmail: smtp.gmail.com / 465 / you@gmail.com / a Google "App password"
 *
 * In local development with nothing configured, emails are printed to the server console instead.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult = { sent: true } | { sent: false; reason: string };

function provider(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

export function mailConfigured() {
  return provider() !== null;
}

/** True when emails are only printed to the console (local development without a provider). */
export function mailIsConsoleOnly() {
  return !mailConfigured() && process.env.NODE_ENV !== "production";
}

function fromAddress() {
  return process.env.MAIL_FROM || (process.env.SMTP_USER ? `Impano Projects <${process.env.SMTP_USER}>` : "Impano Projects <onboarding@resend.dev>");
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const kind = provider();
  try {
    if (kind === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromAddress(), to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[mail] Resend error ${res.status}: ${body}`);
        return { sent: false, reason: "The email service rejected the message." };
      }
      return { sent: true };
    }
    if (kind === "smtp") {
      const nodemailer = (await import("nodemailer")).default;
      const port = Number(process.env.SMTP_PORT || 465);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({ from: fromAddress(), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
      return { sent: true };
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[mail:dev] To: ${msg.to}\n[mail:dev] Subject: ${msg.subject}\n${msg.text}\n`);
      return { sent: true };
    }
    console.error("[mail] No email provider configured (set RESEND_API_KEY or SMTP_* variables).");
    return { sent: false, reason: "Email is not configured on the server yet. Contact the administrator." };
  } catch (err) {
    console.error("[mail] Send failed:", err);
    return { sent: false, reason: "The email could not be sent. Please try again." };
  }
}

/* ---------------- Templates ---------------- */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0d0c0c;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#e8e8e8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141313;border:1px solid #3a2f1a;border-radius:14px">
<tr><td style="padding:28px 32px 8px"><div style="font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#ffad11;font-weight:700">Impano Projects</div>
<h1 style="font-size:22px;margin:14px 0 0;color:#ffffff">${title}</h1></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#cfcece">${body}</td></tr>
</table>
<p style="font-size:12px;color:#6b6b6b;margin-top:16px">Impano Entertainment · internal project tracker</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#ffad11;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;display:inline-block">${label}</a></p>`;

export function otpEmail(name: string, code: string, minutes: number): Omit<MailMessage, "to"> {
  return {
    subject: `${code} is your Impano Projects sign-in code`,
    text: `Hi ${name},\n\nYour sign-in code is: ${code}\n\nIt expires in ${minutes} minutes. If you did not try to sign in, change your password right away.`,
    html: layout(
      "Your sign-in code",
      `<p>Hi ${esc(name)},</p><p>Enter this code to finish signing in:</p>
<p style="font-size:34px;letter-spacing:10px;font-weight:800;color:#ffad11;margin:18px 0;font-family:Consolas,monospace">${code}</p>
<p style="color:#999">It expires in ${minutes} minutes. If you did not try to sign in, change your password right away.</p>`
    ),
  };
}

export function welcomeEmail(name: string, email: string, tempPassword: string, loginUrl: string, reset = false): Omit<MailMessage, "to"> {
  const title = reset ? "Your password was reset" : "You've been invited";
  const intro = reset
    ? "An administrator reset your Impano Projects password."
    : "An administrator created an Impano Projects account for you.";
  return {
    subject: reset ? "Your Impano Projects password was reset" : "Your Impano Projects account",
    text: `Hi ${name},\n\n${intro}\n\nSign in at: ${loginUrl}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nYou will receive a sign-in code by email, and you must choose your own password before you can continue. Do not keep using the temporary password.`,
    html: layout(
      title,
      `<p>Hi ${esc(name)},</p><p>${intro}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#0d0c0c;border:1px solid #2a2a2a;border-radius:8px;width:100%;margin:16px 0">
<tr><td style="padding:14px 18px;font-size:14px"><span style="color:#999">Email</span><br><strong style="color:#fff">${esc(email)}</strong></td></tr>
<tr><td style="padding:0 18px 14px;font-size:14px"><span style="color:#999">Temporary password</span><br><strong style="color:#ffad11;font-family:Consolas,monospace;font-size:16px">${esc(tempPassword)}</strong></td></tr></table>
<p><strong style="color:#fff">You must set your own password</strong> the first time you sign in. We'll also email you a one-time code to confirm it's you.</p>
${button(loginUrl, "Sign in & set my password")}`
    ),
  };
}
