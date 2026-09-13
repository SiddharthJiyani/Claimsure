/**
 * Google Sheets service — mirrors case state to a shared spreadsheet.
 * The sheet acts as a live dashboard visible to judges during the demo.
 * Row format: [CaseNumber, Status, PatientId, InsurerOrg, ServiceType, UpdatedAt]
 */

<<<<<<< HEAD
import { google, type sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { Case } from '../types/index.js';
import { getGoogleAuth } from './google-auth.js';
=======
import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { ServiceUnavailableError } from "../lib/errors.js";
import type { Case } from "../types/index.js";
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d

const SHEET_NAME = "Cases";
const HEADER_ROW = [
  "Case Number",
  "Status",
  "Service Type",
  "Service Code",
  "Patient ID",
  "Insurer Org ID",
  "Created At",
  "Updated At",
];

function getSheetsClient(): sheets_v4.Sheets {
<<<<<<< HEAD
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
=======
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    throw new ServiceUnavailableError(
      "Google Sheets (service account not configured)",
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
}

function caseToRow(c: Case): string[] {
  return [
    c.case_number,
    c.status,
    c.service_type,
    c.service_code ?? "",
    c.patient_id,
    c.insurer_org_id,
    c.created_at,
    c.updated_at,
  ];
}

async function ensureCaseSheet(sheets: sheets_v4.Sheets): Promise<void> {
  if (!env.GOOGLE_SHEETS_ID) return;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    fields: 'sheets(properties(title))',
  });

  const sheetExists = (spreadsheet.data.sheets ?? []).some(
    (sheet) => sheet.properties?.title === SHEET_NAME,
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SHEET_NAME,
              },
            },
          },
        ],
      },
    });
    logger.info('Sheets tab created', { sheetName: SHEET_NAME });
  }
}

export async function ensureHeaderRow(): Promise<void> {
  if (env.DRY_RUN || !env.GOOGLE_SHEETS_ID) return;

  try {
    const sheets = getSheetsClient();
    await ensureCaseSheet(sheets);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A1:H1`,
    });

    const firstRow = res.data.values?.[0] ?? [];
    const hasExpectedHeader = HEADER_ROW.every((header, index) => firstRow[index] === header);

    if (!hasExpectedHeader) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.GOOGLE_SHEETS_ID,
<<<<<<< HEAD
        range: `${SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
=======
        range: `${SHEET_NAME}!A1`,
        valueInputOption: "RAW",
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
        requestBody: { values: [HEADER_ROW] },
      });
    }
  } catch (err) {
<<<<<<< HEAD
    logger.warn('Failed to ensure Sheets header row', { err });
    throw err;
=======
    logger.warn("Failed to ensure Sheets header row", { err });
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
  }
}

export async function appendCaseRow(caseData: Case): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: appendCaseRow", {
      caseNumber: caseData.case_number,
    });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) {
    logger.warn("GOOGLE_SHEETS_ID not configured, skipping Sheets update");
    return;
  }

  try {
    const sheets = getSheetsClient();
    await ensureHeaderRow();

    await sheets.spreadsheets.values.append({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: "RAW",
      requestBody: { values: [caseToRow(caseData)] },
    });
    logger.info("Sheets row appended", { caseNumber: caseData.case_number });
  } catch (err) {
<<<<<<< HEAD
    logger.error('Sheets append failed', err);
    throw err;
=======
    logger.error("Sheets append failed", err);
    // Non-fatal: don't throw, just log
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
  }
}

export async function updateCaseRow(caseData: Case): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug("DRY_RUN: updateCaseRow", {
      caseNumber: caseData.case_number,
    });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) return;

  try {
    const sheets = getSheetsClient();
    await ensureHeaderRow();

    // Find the row with matching case number (column A)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = res.data.values ?? [];
    const rowIndex = rows.findIndex((row) => row[0] === caseData.case_number);

    if (rowIndex === -1) {
      // Row not found — append instead
      await appendCaseRow(caseData);
      return;
    }

    const range = `${SHEET_NAME}!A${rowIndex + 1}:H${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range,
      valueInputOption: "RAW",
      requestBody: { values: [caseToRow(caseData)] },
    });

    logger.info("Sheets row updated", { caseNumber: caseData.case_number });
  } catch (err) {
<<<<<<< HEAD
    logger.error('Sheets update failed', err);
    throw err;
=======
    logger.error("Sheets update failed", err);
    // Non-fatal: don't throw
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
  }
}
