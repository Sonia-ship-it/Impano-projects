"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Loading } from "@/components/ui";
import { IconSearch } from "@/components/Icons";
import { dateTime } from "@/lib/format";
import type { ActivityEntry } from "@/lib/types";

export default function ActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api<{ activity: ActivityEntry[] }>("/api/activity?limit=500")
      .then((d) => setEntries(d.activity))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (entries ?? []).filter((e) => !term || `${e.userName} ${e.action} ${e.target} ${e.details ?? ""}`.toLowerCase().includes(term));
  }, [entries, q]);

  return (
    <>
      <header className="page-header">
        <div>
          <div className="section-tag">Administration</div>
          <h1 className="page-title">Activity Log</h1>
          <p className="page-sub">An audit trail of sign-ins, project changes and access updates.</p>
        </div>
      </header>
      <div className="toolbar">
        <div className="search">
          <IconSearch />
          <input className="input" placeholder="Search by person, action or project…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search activity" />
        </div>
      </div>
      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {!entries && !error ? (
        <Loading />
      ) : (
        <section className="panel">
          {filtered.length === 0 ? (
            <p className="restricted">No activity found.</p>
          ) : (
            <div className="timeline">
              {filtered.map((e) => (
                <div key={e.id} className="timeline-item">
                  <span className="timeline-dot" />
                  <div className="timeline-body">
                    <strong>{e.userName}</strong> {e.action} <em>{e.target}</em>
                    {e.details && <div className="timeline-meta">{e.details}</div>}
                    <div className="timeline-meta">{dateTime(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
