/**
 * Google Sheets service — mirrors case state to a shared spreadsheet.
 */

import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import type { Case } from "../types/index.js";
import { getGoogleAuth } from "./google-auth.js";

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

export type CaseSheetExtras = {
  patient_name?: string;
  disease?: string;
  claim_purpose?: string;
  drive_url?: string;
};

function quotedTab(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getGoogleAuth(["https://www.googleapis.com/auth/spreadsheets"]);
  return google.sheets({ version: "v4", auth });
}

function caseToRow(c: Case, extras: CaseSheetExtras = {}): string[] {
  return [
    c.case_number,
    c.status,
    c.service_type,
    c.service_code ?? "",
    c.patient_id,
    c.insurer_org_id,
    c.created_at,
    c.updated_at,
    extras.patient_name ?? "",
    extras.disease ?? c.payer_id ?? "",
    extras.claim_purpose ?? "",
    extras.drive_url ?? "",
  ];
}

async function resolveSheetName(sheets: sheets_v4.Sheets): Promise<string> {
  const resp = await (sheets.spreadsheets.get as (params: { spreadsheetId: string; fields: string }) => Promise<{ data: sheets_v4.Schema$Spreadsheet }>)({
    spreadsheetId: env.GOOGLE_SHEETS_ID!,
    fields: "sheets(properties(title))",
  });
  const titles = (resp.data.sheets ?? [])
    .map((s: sheets_v4.Schema$Sheet) => s.properties?.title)
    .filter((title: string | null | undefined): title is string => Boolean(title));
  return titles.includes(PREFERRED_TAB) ? PREFERRED_TAB : titles[0] ?? PREFERRED_TAB;
}

export async function ensureHeaderRow(): Promise<string> {
  if (env.DRY_RUN || !env.GOOGLE_SHEETS_ID) return PREFERRED_TAB;

  const sheets = getSheetsClient();
  const sheetName = await resolveSheetName(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: `${quotedTab(sheetName)}!A1:${LAST_COL}1`,
  });
  const firstRow = res.data.values?.[0] ?? [];
  const empty = firstRow.every((cell) => !String(cell ?? "").trim());
  if (empty) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${quotedTab(sheetName)}!A1:${LAST_COL}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADER_ROW] },
    });
  }
  return sheetName;
}

export async function appendCaseRow(
  caseData: Case,
  extras: CaseSheetExtras = {},
): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: appendCaseRow", { caseNumber: caseData.case_number });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) {
    throw new Error("GOOGLE_SHEETS_ID is not configured");
  }

  const sheets = getSheetsClient();
  const sheetName = await ensureHeaderRow();
  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: `${quotedTab(sheetName)}!A:${LAST_COL}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [caseToRow(caseData, extras)] },
  });
  if (!result.data.updates?.updatedRows) {
    throw new Error("Google Sheets accepted the request but wrote 0 rows.");
  }
  logger.info("Sheets row appended", {
    caseNumber: caseData.case_number,
    sheetName,
    range: result.data.updates.updatedRange,
  });
}

export async function updateCaseRow(
  caseData: Case,
  extras: CaseSheetExtras = {},
): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: updateCaseRow", { caseNumber: caseData.case_number });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) return;

  const sheets = getSheetsClient();
  const sheetName = await ensureHeaderRow();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: `${quotedTab(sheetName)}!A:A`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex((row) => row[0] === caseData.case_number);

  if (rowIndex === -1) {
    await appendCaseRow(caseData, extras);
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    range: `${quotedTab(sheetName)}!A${rowIndex + 1}:${LAST_COL}${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [caseToRow(caseData, extras)] },
  });
  logger.info("Sheets row updated", { caseNumber: caseData.case_number, sheetName });
}
