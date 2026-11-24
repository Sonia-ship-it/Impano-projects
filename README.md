# Impano Entertainment Projects

Internal project tracker for Impano Entertainment: every production, its client, status, delivery,
amount charged, payments received, expenses and profit. It has role-based access, and its look
matches the Impano Entertainment website and admin portal.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3100
```

On first visit you are sent to **/setup** to create the administrator account. After that, setup is
disabled and everyone else signs in at **/login** with an account the admin created.

Production: `npm run build && npm start` (port 3100).

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

See `.env.example` for all settings. Set `SESSION_SECRET` in production.

## Security notes

- Passwords are hashed with scrypt. Sessions are HMAC-signed, httpOnly, SameSite=Lax cookies that
  expire after 12 hours.
- After 5 failed logins, that email is locked out for 5 minutes.
- CSV export neutralises spreadsheet formula injection.
