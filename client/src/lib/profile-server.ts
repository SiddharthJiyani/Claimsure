import { createAdminClient } from "@/lib/supabase/admin";
import { isUserRole, type Profile, type UserRole } from "@/lib/types";

const PROFILE_COLUMNS =
  "id, email, full_name, role, organization_id, created_at";

export async function readProfile(userId: string): Promise<Profile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (!data || !isUserRole(data.role)) return null;
  return data as Profile;
}

export async function ensureProfile(input: {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationName?: string | null;
}): Promise<Profile> {
  const existing = await readProfile(input.userId);
  if (existing) return existing;

  const admin = createAdminClient();
  let organizationId: string | null = null;

  if (input.role === "insurance_provider") {
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name: input.organizationName?.trim() || "Demo Insurance",
        type: "insurance_provider",
      })
      .select("id")
      .single();
    if (orgError || !org) {
      const { data: fallback } = await admin
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      organizationId = fallback?.id ?? null;
      if (!organizationId) {
        throw new Error(
          orgError?.message ?? "Could not create healthcare organization",
        );
      }
    } else {
      organizationId = org.id;
    }
  }

  const { data, error } = await admin
    .from("profiles")
    .insert({
      id: input.userId,
      email: input.email,
      full_name: input.fullName.trim() || "User",
      role: input.role,
      organization_id: organizationId,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data || !isUserRole(data.role)) {
    const retry = await readProfile(input.userId);
    if (retry) return retry;
    throw new Error(error?.message ?? "Could not create profile");
  }

  return data as Profile;
}
