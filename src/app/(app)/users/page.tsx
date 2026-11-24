import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import UsersManager from "./UsersManager";

export default async function UsersPage() {
  const session = await getSessionUser();
  if (!session || session.user.role !== "admin") redirect("/dashboard");
  return <UsersManager />;
}
