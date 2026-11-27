"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, initials } from "@/components/AppShell";
import { api, ConfirmDialog, Loading, Modal, StatusBadge, useToast } from "@/components/ui";
import { IconEdit, IconKey, IconMail, IconPlus, IconTrash } from "@/components/Icons";
import { dateTime } from "@/lib/format";
import {
  DEFAULT_MEMBER_PERMISSIONS,
  PERMISSION_LABELS,
  type Permissions,
  type ProjectAccess,
  type ProjectStatus,
  type PublicUser,
  type Role,
} from "@/lib/types";

interface ProjectRef { id: string; code: string; title: string; status: ProjectStatus }

interface Draft {
  id?: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  permissions: Permissions;
  projectAccess: ProjectAccess;
}

const blank: Draft = {
  name: "",
  email: "",
  role: "member",
  active: true,
  permissions: { ...DEFAULT_MEMBER_PERMISSIONS },
  projectAccess: { mode: "all", projectIds: [] },
};

export default function UsersManager() {
  const { user: me } = useSession();
  const toast = useToast();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<PublicUser | null>(null);
  const [toReset, setToReset] = useState<PublicUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    api<{ users: PublicUser[]; projects: ProjectRef[] }>("/api/users")
      .then((d) => {
        setUsers(d.users);
        setProjects(d.projects);
      })
      .catch((e) => toast(e.message, "error"));
  }, [toast]);

  useEffect(load, [load]);

  const openEdit = (u: PublicUser) =>
    setDraft({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, permissions: { ...u.permissions }, projectAccess: { ...u.projectAccess, projectIds: [...u.projectAccess.projectIds] } });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = {
      name: draft.name,
      email: draft.email,
      role: draft.role,
      permissions: draft.permissions,
      projectAccess: draft.projectAccess,
    };
    if (draft.id) body.active = draft.active;
    try {
      const res = await api<{ emailSent?: boolean; emailError?: string }>(draft.id ? `/api/users/${draft.id}` : "/api/users", { method: draft.id ? "PUT" : "POST", body: JSON.stringify(body) });
      if (draft.id) toast("User updated.", "success");
      else if (res.emailSent) toast(`Invitation sent to ${draft.email}.`, "success");
      else toast(`User created, but the email failed: ${res.emailError}. Share the temporary password with them yourself.`, "error");
      setDraft(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await api(`/api/users/${toDelete.id}`, { method: "DELETE" });
      toast("User removed.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!toReset) return;
    setSaving(true);
    try {
      const res = await api<{ emailSent?: boolean; emailError?: string }>(`/api/users/${toReset.id}`, { method: "PUT", body: JSON.stringify({ resetPassword: true }) });
      toast(res.emailSent ? `Password reset. ${toReset.name} has been emailed.` : `Password reset, but the email failed: ${res.emailError}`, res.emailSent ? "success" : "error");
      setToReset(null);
      setDraft(null);
      load();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleProject = (pid: string) => {
    if (!draft) return;
    const ids = draft.projectAccess.projectIds;
    setDraft({ ...draft, projectAccess: { ...draft.projectAccess, projectIds: ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid] } });
  };

  const isSelf = draft?.id === me.id;
  const shownProjects = projects.filter((p) => `${p.code} ${p.title}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <header className="page-header">
        <div>
          <div className="section-tag">Administration</div>
          <h1 className="page-title">Users & Access</h1>
          <p className="page-sub">Invite your team and decide exactly what each person can see and do.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-gold" onClick={() => { setError(""); setDraft({ ...blank, permissions: { ...blank.permissions }, projectAccess: { mode: "all", projectIds: [] } }); }}>
            <IconPlus /> Add User
          </button>
        </div>
      </header>

      {!users ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Access</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const granted = (Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).filter((k) => u.permissions[k]);
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div className="avatar">{initials(u.name)}</div>
                        <div className="title-cell">
                          <strong>{u.name}{u.id === me.id && <span style={{ color: "var(--accent-gold)", fontSize: "0.75rem" }}> (you)</span>}</strong>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.role === "admin" ? <span className="badge badge-gold no-dot">Admin</span> : <span className="badge badge-muted no-dot">Member</span>}</td>
                    <td className="muted" style={{ maxWidth: 280 }}>
                      {u.role === "admin"
                        ? "Full control"
                        : `${u.projectAccess.mode === "all" ? "All projects" : `${u.projectAccess.projectIds.length} selected project(s)`} · ${granted.length ? granted.map((k) => PERMISSION_LABELS[k].label.replace(/^View /, "")).join(", ") : "basic details only"}`}
                    </td>
                    <td>
                      {!u.active ? <span className="badge badge-cancelled">Disabled</span>
                        : u.mustChangePassword ? <span className="badge badge-on_hold" title="Still using the temporary password">Pending</span>
                        : <span className="badge badge-completed">Active</span>}
                    </td>
                    <td className="muted">{u.lastLoginAt ? dateTime(u.lastLoginAt) : "Never"}</td>
                    <td className="num">
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setError(""); openEdit(u); }} aria-label={`Edit ${u.name}`}><IconEdit size={14} /> Edit</button>
                        {u.id !== me.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => setToDelete(u)} aria-label={`Remove ${u.name}`}><IconTrash size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal title={draft.id ? `Edit ${draft.name || "user"}` : "Add User"} onClose={() => setDraft(null)}>
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label className="label" htmlFor="u-name">Full name <span className="req">*</span></label>
                <input id="u-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required autoFocus />
              </div>
              <div className="field">
                <label className="label" htmlFor="u-email">Email <span className="req">*</span></label>
                <input id="u-email" type="email" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
              </div>
              <div className="field full">
                <span className="label">Role</span>
                <div className="segmented" role="group" aria-label="Role">
                  <button type="button" className={draft.role === "member" ? "active" : ""} onClick={() => setDraft({ ...draft, role: "member" })} disabled={isSelf}>Member</button>
                  <button type="button" className={draft.role === "admin" ? "active" : ""} onClick={() => setDraft({ ...draft, role: "admin" })} disabled={isSelf}>Admin</button>
                </div>
                {isSelf && <span className="field-hint">You can’t change your own role.</span>}
              </div>
            </div>

            {!draft.id && (
              <div className="alert alert-info">
                <IconMail size={16} />
                <span>We&apos;ll email them a temporary password and a sign-in link. They must choose their own password the first time they sign in.</span>
              </div>
            )}

            {draft.id && !isSelf && (
              <div className="switch-row" style={{ marginTop: "1rem" }}>
                <div><strong>Password</strong><small>Send them back to the temporary password and email new sign-in instructions.</small></div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToReset(users?.find((u) => u.id === draft.id) ?? null)}>
                  <IconKey size={14} /> Reset
                </button>
              </div>
            )}

            {draft.id && !isSelf && (
              <div className="switch-row">
                <div><strong>Account active</strong><small>Disabled users are signed out and cannot sign in.</small></div>
                <label className="switch"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /><span /></label>
              </div>
            )}

            {draft.role === "admin" ? (
              <div className="alert alert-info">Administrators have full control: all projects, all information, users, permissions and deletion.</div>
            ) : (
              <>
                <h4 className="label" style={{ margin: "1.75rem 0 0.25rem" }}>What can this member see & do?</h4>
                <div>
                  {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((k) => (
                    <div className="switch-row" key={k}>
                      <div><strong>{PERMISSION_LABELS[k].label}</strong><small>{PERMISSION_LABELS[k].hint}</small></div>
                      <label className="switch">
                        <input type="checkbox" aria-label={PERMISSION_LABELS[k].label} checked={draft.permissions[k]} onChange={(e) => setDraft({ ...draft, permissions: { ...draft.permissions, [k]: e.target.checked } })} />
                        <span />
                      </label>
                    </div>
                  ))}
                </div>

                <h4 className="label" style={{ margin: "1.75rem 0 0.75rem" }}>Which projects?</h4>
                <div className="segmented" role="group" aria-label="Project access" style={{ marginBottom: "0.75rem" }}>
                  <button type="button" className={draft.projectAccess.mode === "all" ? "active" : ""} onClick={() => setDraft({ ...draft, projectAccess: { ...draft.projectAccess, mode: "all" } })}>All projects</button>
                  <button type="button" className={draft.projectAccess.mode === "selected" ? "active" : ""} onClick={() => setDraft({ ...draft, projectAccess: { ...draft.projectAccess, mode: "selected" } })}>Only selected</button>
                </div>
                {draft.projectAccess.mode === "selected" && (
                  <>
                    <input className="input" placeholder="Filter projects…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: "0.5rem" }} aria-label="Filter projects" />
                    <div className="checklist">
                      {shownProjects.length === 0 && <p className="restricted" style={{ padding: "0.6rem" }}>No projects found.</p>}
                      {shownProjects.map((p) => (
                        <label key={p.id} className="check-item">
                          <input type="checkbox" checked={draft.projectAccess.projectIds.includes(p.id)} onChange={() => toggleProject(p.id)} />
                          <code>{p.code}</code>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                          <StatusBadge status={p.status} />
                        </label>
                      ))}
                    </div>
                    <span className="field-hint">{draft.projectAccess.projectIds.length} project(s) selected</span>
                  </>
                )}
              </>
            )}

            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? <span className="spinner" /> : draft.id ? "Save Changes" : "Create & Send Invite"}</button>
            </div>
          </form>
        </Modal>
      )}

      {toReset && (
        <ConfirmDialog
          title="Reset password?"
          message={<><strong>{toReset.name}</strong> will be signed out and emailed a temporary password. They&apos;ll have to choose a new one when they sign in.</>}
          confirmLabel="Reset & Email"
          onConfirm={resetPassword}
          onCancel={() => setToReset(null)}
          busy={saving}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Remove user?"
          message={<><strong>{toDelete.name}</strong> ({toDelete.email}) will lose access immediately. Their past activity stays in the log.</>}
          confirmLabel="Remove"
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
          busy={saving}
        />
      )}
    </>
  );
}
