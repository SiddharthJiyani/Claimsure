export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function supabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function apiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
}

export function isSupabaseConfigured() {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  return (
    Boolean(url && key) &&
    !url.includes("YOUR_PROJECT") &&
    !key.startsWith("your_")
  );
}
