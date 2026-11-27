# Impano Entertainment Projects

Internal project tracker for Impano Entertainment: every production, its client, status, delivery,
amount charged, payments received, expenses and profit. It has role-based access, and its look
matches the Impano Entertainment website and admin portal.

## Quick start

```bash
npm install
# create .env.local with at least ADMIN_EMAIL and ADMIN_PASSWORD (see "Deploying to Vercel" below)
npm run dev                  # http://localhost:3100
```

Without an email provider configured locally, sign-in codes and invitation emails are printed to
the terminal and the code is shown on the login screen (development only).

## Signing in

1. **Email + password.**
2. **One-time code**: a 6-digit code is emailed to the account's address (valid 10 minutes, 5 tries,
   resend after 30 s). The session only starts once the code is confirmed.
3. **New or reset accounts** must choose their own password before they can use the app.

The **administrator** account is created automatically from `ADMIN_EMAIL` / `ADMIN_PASSWORD` the
first time the app runs. **New members** don't need a password from the admin: they all start on the
temporary password (`DEFAULT_USER_PASSWORD`, default `test@impanoent`), get a welcome email with it,
and are forced to replace it on first sign-in. "Reset password" in Users & Access does the same again.

## Deploying to Vercel

Set these in **Vercel → Project → Settings → Environment Variables**, then redeploy:

| Variable | Why |
|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (+ optional `ADMIN_NAME`) | Creates the administrator account |
| `SESSION_SECRET` | Signs sessions (any long random string) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Storage: Vercel's disk is not persistent. Add an Upstash Redis database from the Vercel Marketplace and these are filled in for you |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` **or** `RESEND_API_KEY`, `MAIL_FROM` | Sends sign-in codes and invitations. **Without this nobody can sign in in production.** |
| `APP_URL` (optional) | Your domain, used in email links, e.g. `https://projects.impanoent.com` |

**Gmail:** turn on 2-Step Verification for the account, create an App Password at
https://myaccount.google.com/apppasswords, and use `smtp.gmail.com`, port `465`, your Gmail address
and that app password. **Resend:** verify your domain at resend.com and send from an address on it.

## Roles & permissions

| | Administrator | Member |
|---|---|---|
| See projects | All | All, **or only projects the admin selects** |
| Basic details (title, client name, status, dates, crew, deliverables) | ✅ | ✅ |
| Financials (charged, payments, expenses, balance, profit, revenue dashboard) | ✅ | If allowed |
| Client email / phone | ✅ | If allowed |
| Internal notes | ✅ | If allowed |
| Create & edit projects | ✅ | If allowed (cannot change fields they can't see) |
| Export CSV | ✅ | If allowed |
| Delete projects | ✅ | ❌ |
| Manage users, permissions, activity log | ✅ | ❌ |

Permissions are enforced **on the server**: hidden fields are never sent to the browser, and a member
cannot overwrite them through the API. Admins manage this under **Users & Access**. Changing a
user's role, disabling them or resetting their password signs them out at once. The system always
keeps at least one active admin.

## Features

- **Dashboard**: project counts by status, total charged, collected, outstanding and profit (per
  currency), payments per month (last 12 months), recently updated projects and the largest
  outstanding balances.
- **Projects**: search, filter by status, category, payment state and year, sortable columns, and
  totals for the filtered list. Each project gets an automatic code (`IMP-2026-001`).
- **Project record**: category, status, dates, location, lead, crew, description, deliverables,
  delivery link, client details, currency (RWF/USD/EUR), amount charged, a payment ledger (date,
  method, reference), an expense ledger, live balance and profit, internal notes, and who
  created and last updated it.
- **Activity log**: an audit trail of sign-ins, project changes, status moves and access changes.
- **CSV export**: respects the exporter's permissions.

## Data storage

- **Default:** a JSON file at `./data/db.json` (gitignored). **Back this folder up.**
- **Serverless (Vercel):** the filesystem there is not persistent, so set `KV_REST_API_URL` and
  `KV_REST_API_TOKEN` (Upstash Redis / Vercel KV). The database is stored under `KV_DB_KEY`
  (default `impano_projects_db`), separate from the website's CMS key.

All settings are listed under "Deploying to Vercel" above. Never commit `.env` files; they are gitignored.

## Security notes

- Passwords are hashed with scrypt. Sessions are HMAC-signed, httpOnly, SameSite=Lax cookies that
  expire after 12 hours.
- Two-step sign-in: password + emailed one-time code (hashed at rest, 10-minute expiry, 5 attempts).
- After 5 failed passwords, that email is locked out for 10 minutes (tracked in the database, so it
  works on serverless hosts).
- Passwords need 8+ characters with a letter and a number, and can't be the temporary password.
- CSV export neutralises spreadsheet formula injection.
