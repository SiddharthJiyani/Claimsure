import { redirect } from "next/navigation";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHome } from "@/components/MarketingHome";
import { MarketingNav } from "@/components/MarketingNav";
import { getProfile, getSessionUser } from "@/lib/auth";
import { roleHome } from "@/lib/types";

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    const profile = await getProfile();
    if (profile) redirect(roleHome(profile.role));
    redirect("/complete-profile");
  }

  return (
    <div className="auth-grid min-h-full">
      <MarketingNav />
      <main className="mx-auto w-full max-w-7xl px-5 sm:px-6">
        <MarketingHome />
      </main>
      <MarketingFooter />
    </div>
  );
}
