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

export function slackChannelName() {
  return process.env.NEXT_PUBLIC_SLACK_CHANNEL_NAME ?? "claimsure-updates";
}

export function slackWorkspaceUrl() {
  return process.env.NEXT_PUBLIC_SLACK_WORKSPACE_URL ?? "https://slack.com";
}

export function googleDriveRootFolderId() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID ??
    process.env.GOOGLE_DRIVE_FOLDER_ID ??
    "1iOcj-7ti-LRogZ9HfYTgnpIrvoYkRrFb"
  );
}

export function googleSheetsId() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_SHEETS_ID ??
    process.env.GOOGLE_SHEETS_ID ??
    "1NmNJclpofp05eya8xvVmg06CJg9dBObrS1MLwoR7zdM"
  );
}

export function googleCalendarId() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID ??
    process.env.GOOGLE_CALENDAR_ID ??
    "1c77080788dd6097dba6c8de5df279d3ef4341d2ab89a33952a70ebdb5070201@group.calendar.google.com"
  );
}

export function googleSheetsUrl() {
  const id = googleSheetsId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "https://docs.google.com/spreadsheets";
}

export function googleDriveFolderUrl() {
  const id = googleDriveRootFolderId();
  return id ? `https://drive.google.com/drive/folders/${id}` : "https://drive.google.com";
}

export function googleCalendarUrl() {
  return "https://calendar.google.com/calendar/u/0/r";
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
