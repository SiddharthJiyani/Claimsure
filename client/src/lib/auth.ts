import { isSupabaseConfigured } from "@/lib/env";
import { readProfile } from "@/lib/profile-server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  try {
    return await readProfile(user.id);
  } catch {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, organization_id, created_at")
      .eq("id", user.id)
      .maybeSingle();
    return data as Profile | null;
  }
}
