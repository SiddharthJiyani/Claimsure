import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

export function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function createAdminClient() {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing from client/.env.local (server-only, no NEXT_PUBLIC_ prefix).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
