import type { Permissions, ProjectAccess, Role } from "./types";
import { DEFAULT_MEMBER_PERMISSIONS, PERMISSION_LABELS } from "./types";

type Input = Record<string, unknown>;

export function parseRole(v: unknown): Role | null {
  return v === "admin" || v === "member" ? v : null;
}

export function parsePermissions(v: unknown, base: Permissions = DEFAULT_MEMBER_PERMISSIONS): Permissions {
  const out = { ...base };
  if (v && typeof v === "object") {
    for (const key of Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]) {
      if (key in (v as Input)) out[key] = (v as Input)[key] === true;
    }
  }
  return out;
}

export function parseProjectAccess(v: unknown, validIds: Set<string>): ProjectAccess {
  const raw = (v && typeof v === "object" ? v : {}) as Input;
  const mode = raw.mode === "selected" ? "selected" : "all";
  const ids = Array.isArray(raw.projectIds) ? raw.projectIds.filter((x): x is string => typeof x === "string" && validIds.has(x)) : [];
  return { mode, projectIds: Array.from(new Set(ids)) };
}

export function parseEmail(v: unknown): string | null {
  const email = typeof v === "string" ? v.trim().toLowerCase().slice(0, 200) : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
