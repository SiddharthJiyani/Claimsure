import { google } from "googleapis";

function configuredSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID ?? "";
}

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

const PREFERRED_TAB = "Cases";
const HEADER_ROW = [
  "Case Number",
  "Status",
  "Service Type",
  "Service Code",
  "Patient ID",
  "Insurer Org ID",
  "Created At",
  "Updated At",
  "Patient Name",
  "Disease",
  "Claim Purpose",
  "Drive URL",
];
const LAST_COL = "L";

export type CaseSheetRow = {
  case_number: string;
  status: string;
  service_type: string;
  service_code?: string | null;
  patient_id: string;
  insurer_org_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  patient_name?: string | null;
  disease?: string | null;
  claim_purpose?: string | null;
  drive_url?: string | null;
};

function quotedTab(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function sheetsClient() {
  const { clientId, clientSecret, redirectUri, refreshToken } = oauthCreds();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.",
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth });
}

function toValues(row: CaseSheetRow) {
  return [
    row.case_number,
    row.status,
    row.service_type,
    row.service_code ?? "",
    row.patient_id,
    row.insurer_org_id,
    row.created_at ?? "",
    row.updated_at ?? "",
    row.patient_name ?? "",
    row.disease ?? "",
    row.claim_purpose ?? "",
    row.drive_url ?? "",
  ];
}

function googleMessage(err: unknown) {
  if (err && typeof err === "object") {
    const maybe = err as {
      message?: string;
      response?: { data?: { error?: { message?: string; status?: string } } };
    };
    const api = maybe.response?.data?.error;
    if (api?.message) {
      return `${api.status ?? "Sheets"}: ${api.message}`;
    }
    if (maybe.message) return maybe.message;
  }
  return "Google Sheets sync failed";
}

async function ensureSheet() {
  const spreadsheetId = configuredSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_ID is missing from client/.env.local.");
  }

  const sheets = sheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const titles = (spreadsheet.data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
  const sheetName = titles.includes(PREFERRED_TAB)
    ? PREFERRED_TAB
    : titles[0] ?? PREFERRED_TAB;

  if (!titles.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }

  const header = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quotedTab(sheetName)}!A1:${LAST_COL}1`,
  });
  const firstRow = header.data.values?.[0] ?? [];
  const empty = firstRow.every((cell) => !String(cell ?? "").trim());
  if (empty) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quotedTab(sheetName)}!A1:${LAST_COL}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADER_ROW] },
    });
  }

  return { sheets, spreadsheetId, sheetName };
}

export async function appendCaseRow(row: CaseSheetRow) {
  try {
    const { sheets, spreadsheetId, sheetName } = await ensureSheet();
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${quotedTab(sheetName)}!A:${LAST_COL}`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [toValues(row)] },
    });
    if (!result.data.updates?.updatedRows) {
      throw new Error("Google Sheets accepted the request but wrote 0 rows.");
    }
  } catch (err) {
    throw new Error(googleMessage(err));
  }
}
