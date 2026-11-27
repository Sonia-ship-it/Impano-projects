"use client";

import React, { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import { IconActivity, IconDashboard, IconFilm, IconLogout, IconMenu, IconUser, IconUsers } from "./Icons";
import { ToastProvider } from "./ui";
import type { Permissions, PublicUser } from "@/lib/types";

interface SessionInfo {
  user: PublicUser;
  permissions: Permissions;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionInfo | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside AppShell");
  return ctx;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function AppShell({
  user,
  permissions,
  children,
}: {
  user: PublicUser;
  permissions: Permissions;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // The drawer remembers which path it was opened on, so navigating closes it automatically.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (v: boolean) => setOpenedOn(v ? pathname : null);
  const isAdmin = user.role === "admin";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: <IconDashboard /> },
    { href: "/projects", label: "Projects", icon: <IconFilm /> },
  ];
  const adminNav = [
    { href: "/users", label: "Users & Access", icon: <IconUsers /> },
    { href: "/activity", label: "Activity Log", icon: <IconActivity /> },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <SessionContext.Provider value={{ user, permissions, isAdmin }}>
      <ToastProvider>
        <div className="mobile-bar">
          <Link href="/dashboard" className="brand brand-compact" aria-label="Projects — home">
            <Logo size={36} />
            <span className="brand-word">Projects</span>
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Open menu">
            <IconMenu />
          </button>
        </div>
        <div className={`sidebar-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
        <div className="shell">
          <aside className={`sidebar ${open ? "open" : ""}`}>
            <Link href="/dashboard" className="brand" aria-label="Projects — home">
              <Logo size={48} />
              <span className="brand-word">Projects</span>
            </Link>
            <div className="nav-label">Workspace</div>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={`tab-btn ${isActive(n.href) ? "active" : ""}`}>
                {n.icon}
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <div className="nav-label">Administration</div>
                {adminNav.map((n) => (
                  <Link key={n.href} href={n.href} className={`tab-btn ${isActive(n.href) ? "active" : ""}`}>
                    {n.icon}
                    {n.label}
                  </Link>
                ))}
              </>
            )}
            <div className="sidebar-footer">
              <Link href="/account" className={`tab-btn ${isActive("/account") ? "active" : ""}`}>
                <IconUser />
                My Account
              </Link>
              <div className="user-chip">
                <div className="avatar">{initials(user.name)}</div>
                <div className="user-chip-text">
                  <strong>{user.name}</strong>
                  <span>{isAdmin ? "Administrator" : "Member"}</span>
                </div>
                <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
                  <IconLogout />
                </button>
              </div>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </ToastProvider>
    </SessionContext.Provider>
  );
}
