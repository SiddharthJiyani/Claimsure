import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("your_") || value.includes("YOUR_PROJECT")) {
    throw new Error(
      `Missing or placeholder env: ${name}. Update server/.env with your Supabase credentials.`,
    );
  }
  return value;
}

let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  serviceClient = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return serviceClient;
}

export function getAnonClient(): SupabaseClient {
  if (anonClient) return anonClient;
  anonClient = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return anonClient;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? "";
  const anon = process.env.SUPABASE_ANON_KEY ?? "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return (
    Boolean(url && anon && service) &&
    !url.includes("YOUR_PROJECT") &&
    !anon.startsWith("your_")
  );
}
