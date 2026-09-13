import { redirect } from "next/navigation";
import { AppShell } from "@/components/Sidebar";
import { getProfile, getSessionUser } from "@/lib/auth";

export default async function InsuranceLayout({
  children,
}: LayoutProps<"/insurance">) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/insurance");
  const profile = await getProfile();
  if (!profile) redirect("/complete-profile");
  if (profile.role !== "insurance_provider") redirect("/patient");

  return <AppShell role="insurance_provider">{children}</AppShell>;
}
