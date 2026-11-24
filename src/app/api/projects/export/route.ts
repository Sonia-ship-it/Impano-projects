import { effectivePermissions, jsonError, requireUser } from "@/lib/auth";
import { computeTotals, toView, visibleProjects } from "@/lib/projects";
import { STATUS_LABELS } from "@/lib/types";

function cell(value: unknown) {
  let s = value == null ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await requireUser();
  if (session.error) return session.error;
  const perms = effectivePermissions(session.user);
  if (!perms.exportData) return jsonError("You do not have permission to export data.", 403);

  const columns: [string, (p: ReturnType<typeof toView>) => unknown][] = [
    ["Code", (p) => p.code],
    ["Title", (p) => p.title],
    ["Category", (p) => p.category],
    ["Status", (p) => STATUS_LABELS[p.status]],
    ["Client", (p) => p.clientName],
    ["Company", (p) => p.clientCompany],
  ];
  if (perms.viewClientContacts) columns.push(["Client Email", (p) => p.clientEmail], ["Client Phone", (p) => p.clientPhone]);
  columns.push(
    ["Location", (p) => p.location],
    ["Start Date", (p) => p.startDate],
    ["End / Delivery Date", (p) => p.endDate],
    ["Project Lead", (p) => p.projectLead],
    ["Team", (p) => p.team?.join("; ")],
    ["Deliverables", (p) => p.deliverables?.join("; ")],
    ["Delivery Link", (p) => p.deliveryLink],
  );
  if (perms.viewFinancials) {
    columns.push(
      ["Currency", (p) => p.currency],
      ["Amount Charged", (p) => p.amountCharged],
      ["Amount Paid", (p) => p.totals?.amountPaid],
      ["Balance", (p) => p.totals?.balance],
      ["Expenses", (p) => p.totals?.totalExpenses],
      ["Profit", (p) => p.totals?.profit],
      ["Payment Status", (p) => p.totals?.paymentStatus],
    );
  }
  if (perms.viewNotes) columns.push(["Notes", (p) => p.notes]);
  columns.push(["Last Updated", (p) => p.updatedAt], ["Updated By", (p) => p.updatedBy]);

  const rows = visibleProjects(session.user, session.db)
    .map((p) => {
      const v = toView(p, session.user);
      if (perms.viewFinancials) v.totals = computeTotals(p);
      return v;
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const csv = [columns.map(([h]) => cell(h)).join(","), ...rows.map((r) => columns.map(([, get]) => cell(get(r))).join(","))].join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="impano-projects-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
