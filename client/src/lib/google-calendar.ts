import { google } from "googleapis";

function oauthCreds() {
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ??
      "http://localhost:5001/oauth2callback",
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "",
  };
}

export type CaseCalendarEvent = {
  event_id: string;
  html_link: string | null;
  start_date: string;
};

function calendarClient() {
  const { clientId, clientSecret, redirectUri, refreshToken } = oauthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.",
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

function datePlusDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function createCaseReviewEvent(input: {
  caseNumber: string;
  patientName?: string;
  serviceType?: string;
  disease?: string;
  claimPurpose?: string;
  driveUrl?: string;
  reviewInDays?: number;
}): Promise<CaseCalendarEvent> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "";
  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID is missing from client/.env.local.");
  }

  const startDate = datePlusDays(input.reviewInDays ?? 3);
  const endDate = datePlusDays((input.reviewInDays ?? 3) + 1);
  const description = [
    `Case: ${input.caseNumber}`,
    input.patientName ? `Patient: ${input.patientName}` : "",
    input.serviceType ? `Service: ${input.serviceType}` : "",
    input.disease ? `Disease: ${input.disease}` : "",
    input.claimPurpose ? `Purpose: ${input.claimPurpose}` : "",
    input.driveUrl ? `Drive: ${input.driveUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const calendar = calendarClient();
  const created = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Claim review: ${input.caseNumber}`,
      description,
      start: { date: startDate },
      end: { date: endDate },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 * 24 },
          { method: "popup", minutes: 60 * 12 },
        ],
      },
    },
  });

  if (!created.data.id) {
    throw new Error("Google Calendar did not return an event id");
  }

  return {
    event_id: created.data.id,
    html_link: created.data.htmlLink ?? null,
    start_date: startDate,
  };
}
