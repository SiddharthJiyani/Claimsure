import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  PENDING_ORG_COOKIE,
  PENDING_ROLE_COOKIE,
  roleFromUnknown,
} from "@/lib/pending-role";
import { ensureProfile, readProfile } from "@/lib/profile-server";
import { roleHome, type Profile } from "@/lib/types";

export default async function CompleteProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/complete-profile");

  const existing = await readProfile(user.id);
  if (existing) redirect(roleHome(existing.role));

  const cookieStore = await cookies();
  const role =
    roleFromUnknown(user.user_metadata.role) ??
    roleFromUnknown(cookieStore.get(PENDING_ROLE_COOKIE)?.value) ??
    "patient";

  let profile: Profile;
  try {
    profile = await ensureProfile({
      userId: user.id,
      email: user.email ?? "",
      fullName:
        (user.user_metadata.full_name as string | undefined) ||
        (user.user_metadata.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "User",
      role,
      organizationName:
        (typeof user.user_metadata.organization_name === "string"
          ? user.user_metadata.organization_name
          : "") ||
        decodeURIComponent(cookieStore.get(PENDING_ORG_COOKIE)?.value ?? ""),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create your profile";
    return (
      <div className="auth-grid grid min-h-full place-items-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-8">
          <h1 className="text-xl font-semibold">Could not finish signup</h1>
          <p className="mt-3 text-sm text-danger">{message}</p>
          <p className="mt-3 text-sm text-muted">
            Confirm <span className="font-mono">schema.sql</span> has been run
            and <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> is
            set in <span className="font-mono">client/.env.local</span>, then
            restart the Next.js app.
          </p>
        </div>
      </div>
    );
  }

  cookieStore.delete(PENDING_ROLE_COOKIE);
  cookieStore.delete(PENDING_ORG_COOKIE);
  redirect(roleHome(profile.role));
}
