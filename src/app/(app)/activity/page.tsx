import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ActivityLog from "./ActivityLog";

export default async function ActivityPage() {
  const session = await getSessionUser();
  if (!session || session.user.role !== "admin") redirect("/dashboard");
  return <ActivityLog />;
}
