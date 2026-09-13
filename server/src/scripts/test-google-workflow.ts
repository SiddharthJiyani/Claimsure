import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { uploadFile, getFileMetadata } from '../services/google-drive.js';
import { appendCaseRow, updateCaseRow } from '../services/google-sheets.js';
import { createAppealDeadlineEvent } from '../services/google-calendar.js';
import { env } from '../config/env.js';
import type { Case } from '../types/index.js';

interface Args {
  filePath: string;
  caseNumber: string;
  patientId: string;
  insurerOrgId: string;
  serviceType: string;
  serviceCode: string;
  payerId: string;
  status: Case['status'];
  deadline: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string): string => {
    const prefix = `--${name}=`;
    return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
  };

  const today = new Date();
  const deadline = new Date(today);
  deadline.setDate(today.getDate() + 30);

  return {
    filePath: resolve(process.cwd(), get('file', '../ai-server/sample_denial_letter.txt')),
    caseNumber: get('case-number', `GOOGLE-TEST-${Date.now()}`),
    patientId: get('patient-id', randomUUID()),
    insurerOrgId: get('insurer-org-id', randomUUID()),
    serviceType: get('service-type', 'MRI Lumbar Spine'),
    serviceCode: get('service-code', 'CPT-72148'),
    payerId: get('payer-id', 'payer_a'),
    status: get('status', 'PENDING') as Case['status'],
    deadline: get('deadline', deadline.toISOString().split('T')[0] ?? '2026-10-13'),
  };
}

function mimeTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function buildCase(args: Args): Case {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    case_number: args.caseNumber,
    patient_id: args.patientId,
    insurer_org_id: args.insurerOrgId,
    service_type: args.serviceType,
    service_code: args.serviceCode,
    payer_id: args.payerId,
    status: args.status,
    created_at: now,
    updated_at: now,
  };
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!existsSync(args.filePath)) {
    throw new Error(`File not found: ${args.filePath}`);
  }

  if (env.DRY_RUN) {
    console.log('DRY_RUN=true, so services will return fixtures instead of writing to Google.');
    console.log('Set DRY_RUN=false in server/.env for a real Drive/Sheets/Calendar smoke test.');
    console.log('');
  }

  console.log('Claimsure real Google workflow smoke test');
  console.log(`File: ${args.filePath}`);
  console.log(`Case number: ${args.caseNumber}`);
  console.log('');

  const fileContent = readFileSync(args.filePath);
  const upload = await uploadFile({
    name: `${args.caseNumber}-${basename(args.filePath)}`,
    mimeType: mimeTypeFor(args.filePath),
    content: fileContent,
  });

  const metadata = await getFileMetadata(upload.id);
  console.log('[PASS] Drive upload');
  console.log(`  file_id: ${metadata.id}`);
  console.log(`  name: ${metadata.name}`);
  console.log(`  url: ${metadata.webViewLink ?? '(no webViewLink returned)'}`);
  console.log('');

  const caseRow = buildCase(args);
  await appendCaseRow(caseRow);
  console.log('[PASS] Sheets append row');
  console.log(`  spreadsheet_id: ${env.GOOGLE_SHEETS_ID ?? '(unset)'}`);
  console.log(`  case_number: ${caseRow.case_number}`);
  console.log(`  status: ${caseRow.status}`);
  console.log('');

  const updatedCaseRow: Case = {
    ...caseRow,
    status: 'ACTION_REQUIRED',
    updated_at: new Date().toISOString(),
  };
  await updateCaseRow(updatedCaseRow);
  console.log('[PASS] Sheets update row');
  console.log(`  case_number: ${updatedCaseRow.case_number}`);
  console.log(`  new_status: ${updatedCaseRow.status}`);
  console.log('');

  const event = await createAppealDeadlineEvent({
    summary: `Claimsure Test Deadline: ${args.caseNumber}`,
    description: [
      'Real Google Calendar smoke test created by Claimsure.',
      `Drive file ID: ${metadata.id}`,
      `Service: ${args.serviceType} (${args.serviceCode})`,
    ].join('\n'),
    startDate: args.deadline,
  });

  console.log('[PASS] Calendar event');
  console.log(`  event_id: ${event.id}`);
  console.log(`  summary: ${event.summary}`);
  console.log(`  date: ${event.start}`);
  console.log(`  url: ${event.htmlLink ?? '(no htmlLink returned)'}`);
  console.log('');

  console.log('Done. Verify the Drive file, Sheets row, and Calendar event in Google.');
  console.log('Tip: Use POST /api/cases/:id/documents/upload for the full wired product flow.');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[FAIL] Google workflow smoke test failed');
  console.error(message);

  // Give clear guidance for the most common Drive failure
  if (message.includes('storage quota') || message.includes('Shared Drive') || message.includes('shared drives')) {
    console.error('');
    console.error('─────────────────────────────────────────────────────────────────');
    console.error('FIX: Service accounts cannot upload to a personal "My Drive" folder.');
    console.error('');
    console.error('Steps to fix:');
    console.error('  1. Open drive.google.com → create or open a Shared Drive.');
    console.error('  2. Add your service account email as Contributor or Content Manager.');
    console.error('     (Settings → Manage members → paste service account email)');
    console.error('  3. Inside that Shared Drive, create a folder for Claimsure evidence files.');
    console.error('  4. Copy the folder ID from the URL:');
    console.error('     https://drive.google.com/drive/folders/<FOLDER_ID_HERE>');
    console.error('  5. Update server/.env:');
    console.error('     GOOGLE_DRIVE_FOLDER_ID=<paste FOLDER_ID here>');
    console.error('  6. Re-run:  pnpm test:google-workflow');
    console.error('─────────────────────────────────────────────────────────────────');
  }

  process.exit(1);
});
