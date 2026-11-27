import { redirect } from "next/navigation";
import { DEFAULT_USER_PASSWORD, getSessionUser } from "@/lib/auth";
import UsersManager from "./UsersManager";

export default async function UsersPage() {
  const session = await getSessionUser();
  if (!session || session.user.role !== "admin") redirect("/dashboard");
  return <UsersManager defaultPassword={DEFAULT_USER_PASSWORD} />;
}
