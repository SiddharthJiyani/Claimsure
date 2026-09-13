import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PENDING_ORG_COOKIE,
  PENDING_ROLE_COOKIE,
  roleFromUnknown,
} from "@/lib/pending-role";
import { ensureProfile, readProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const role =
    roleFromUnknown(searchParams.get("role")) ??
    roleFromUnknown(user.user_metadata.role) ??
    roleFromUnknown(cookieStore.get(PENDING_ROLE_COOKIE)?.value) ??
    "patient";
  const organizationName =
    searchParams.get("organization_name") ||
    (typeof user.user_metadata.organization_name === "string"
      ? user.user_metadata.organization_name
      : "") ||
    decodeURIComponent(cookieStore.get(PENDING_ORG_COOKIE)?.value ?? "");

  const existing = await readProfile(user.id);
  const profile =
    existing ??
    (await ensureProfile({
      userId: user.id,
      email: user.email ?? "",
      fullName:
        (user.user_metadata.full_name as string | undefined) ||
        (user.user_metadata.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "User",
      role,
      organizationName,
    }));

  cookieStore.delete(PENDING_ROLE_COOKIE);
  cookieStore.delete(PENDING_ORG_COOKIE);

  const destination =
    next && next.startsWith("/") && next !== "/complete-profile"
      ? next
      : roleHome(profile.role);
  return NextResponse.redirect(`${origin}${destination}`);
}
