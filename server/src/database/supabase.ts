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

/**
 * Named proxy exports for backwards compatibility with query files.
 * These are Proxy objects that lazily call getServiceClient()/getAnonClient()
 * on first property access, so initialization order doesn't matter.
 */
export const supabase = new Proxy({} as ReturnType<typeof getServiceClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getServiceClient(), prop, receiver);
  },
});

export const supabaseAnon = new Proxy({} as ReturnType<typeof getAnonClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getAnonClient(), prop, receiver);
  },
});

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