import { redirect } from "next/navigation";
import { AppShell } from "@/components/Sidebar";
import { getProfile, getSessionUser } from "@/lib/auth";

export default async function PatientLayout({
  children,
}: LayoutProps<"/patient">) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/patient");
  const profile = await getProfile();
  if (!profile) redirect("/complete-profile");
  if (profile.role !== "patient") redirect("/insurance");

  return <AppShell role="patient">{children}</AppShell>;
}
