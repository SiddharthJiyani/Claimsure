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
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(
    /\/$/,
    "",
  );
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export function aiServerUrl() {
  return (
    process.env.AI_SERVER_URL ??
    process.env.NEXT_PUBLIC_AI_SERVER_URL ??
    "http://localhost:8000"
  ).replace(/\/$/, "");
}

export function googleDriveRootFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID ?? "";
}

export function googleSheetsId() {
  return process.env.GOOGLE_SHEETS_ID ?? "";
}

export function googleCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID ?? "";
}

export function googleOAuth() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ??
      "http://localhost:5001/oauth2callback",
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
  };
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
