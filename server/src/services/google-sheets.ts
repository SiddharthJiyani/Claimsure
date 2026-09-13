/**
 * Google Sheets service — mirrors case state to a shared spreadsheet.
 * The sheet acts as a live dashboard visible to judges during the demo.
 * Row format: [CaseNumber, Status, PatientId, InsurerOrg, ServiceType, UpdatedAt]
 */

import { google, type sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { ServiceUnavailableError } from '../lib/errors.js';
import type { Case } from '../types/index.js';

const SHEET_NAME = 'Cases';
const HEADER_ROW = [
  'Case Number', 'Status', 'Service Type', 'Service Code',
  'Patient ID', 'Insurer Org ID', 'Created At', 'Updated At',
];

function getSheetsClient(): sheets_v4.Sheets {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    throw new ServiceUnavailableError('Google Sheets (service account not configured)');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function caseToRow(c: Case): string[] {
  return [
    c.case_number,
    c.status,
    c.service_type,
    c.service_code ?? '',
    c.patient_id,
    c.insurer_org_id,
    c.created_at,
    c.updated_at,
  ];
}

export async function ensureHeaderRow(): Promise<void> {
  if (env.DRY_RUN || !env.GOOGLE_SHEETS_ID) return;

  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A1:H1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.GOOGLE_SHEETS_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADER_ROW] },
      });
    }
  } catch (err) {
    logger.warn('Failed to ensure Sheets header row', { err });
  }
}

export async function appendCaseRow(caseData: Case): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug('DRY_RUN: appendCaseRow', { caseNumber: caseData.case_number });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) {
    logger.warn('GOOGLE_SHEETS_ID not configured, skipping Sheets update');
    return;
  }

  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      range: `${SHEET_NAME}!A:H`,
      valueInputOption: 'RAW',
      requestBody: { values: [caseToRow(caseData)] },
    });
    logger.info('Sheets row appended', { caseNumber: caseData.case_number });
  } catch (err) {
    logger.error('Sheets append failed', err);
    // Non-fatal: don't throw, just log
  }
}

export async function updateCaseRow(caseData: Case): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug('DRY_RUN: updateCaseRow', { caseNumber: caseData.case_number });
    return;
  }

  if (!env.GOOGLE_SHEETS_ID) return;

  try {
    const sheets = getSheetsClient();

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
      valueInputOption: 'RAW',
      requestBody: { values: [caseToRow(caseData)] },
    });

    logger.info('Sheets row updated', { caseNumber: caseData.case_number });
  } catch (err) {
    logger.error('Sheets update failed', err);
    // Non-fatal: don't throw
  }
}
