import { redirect } from "next/navigation";
import { DEFAULT_USER_PASSWORD, getSessionUser } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata = { title: "Set your password · Impano Projects" };

export default async function ChangePasswordPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");
  return <ChangePasswordForm name={session.user.name.split(/\s+/)[0]} email={session.user.email} tempPassword={DEFAULT_USER_PASSWORD} />;
}
