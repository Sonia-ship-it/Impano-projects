import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { effectivePermissions, getSessionUser, toPublicUser } from "@/lib/auth";
import { readDB } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) {
    const db = await readDB();
    redirect(db.users.length === 0 ? "/setup" : "/login");
  }
  if (session.user.mustChangePassword) redirect("/change-password");
  return (
    <AppShell user={toPublicUser(session.user)} permissions={effectivePermissions(session.user)}>
      {children}
    </AppShell>
  );
}
