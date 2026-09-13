import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { env } from '../config/env.js';
import { getServiceClient } from '../database/supabase.js';
import { smtpConfigured, verifySmtpConnection } from '../services/gmail.js';
import { getGoogleAuth, getGoogleAuthMode } from '../services/google-auth.js';

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(serverRoot, '..');

const results: CheckResult[] = [];

function record(name: string, status: CheckStatus, detail: string): void {
  results.push({ name, status, detail });
  const icon = status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : status === 'warn' ? 'WARN' : 'SKIP';
  console.log(`[${icon}] ${name}: ${detail}`);
}

function configured(value?: string): boolean {
  return Boolean(value && !value.includes('your_') && !value.includes('placeholder'));
}

async function checkSupabase(): Promise<void> {
  try {
    const { error, count } = await getServiceClient()
      .from('cases')
      .select('id', { count: 'exact', head: true });

    if (error) throw new Error(error.message);
    record('Supabase service-role DB', 'pass', `connected; cases table count=${count ?? 0}`);
  } catch (err) {
    record('Supabase service-role DB', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkDrive(): Promise<void> {
  if (!configured(env.GOOGLE_DRIVE_FOLDER_ID)) {
    record('Google Drive', 'skip', 'GOOGLE_DRIVE_FOLDER_ID is not configured');
    return;
  }

  try {
    const drive = google.drive({
      version: 'v3',
      auth: getGoogleAuth(['https://www.googleapis.com/auth/drive.readonly']),
    });
    const res = await drive.files.list({
      q: `'${env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`,
      pageSize: 5,
      fields: 'files(id,name,mimeType),nextPageToken',
    });
    record('Google Drive', 'pass', `listed ${res.data.files?.length ?? 0} file(s) from configured folder`);
  } catch (err) {
    record('Google Drive', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkSheets(): Promise<void> {
  if (!configured(env.GOOGLE_SHEETS_ID)) {
    record('Google Sheets', 'skip', 'GOOGLE_SHEETS_ID is not configured');
    return;
  }

  try {
    const sheets = google.sheets({
      version: 'v4',
      auth: getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']),
    });
    const res = await (sheets.spreadsheets.get as any)({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      fields: 'properties(title),sheets(properties(title))',
    });
    const sheetNames = res.data.sheets?.map((s: any) => s.properties?.title).filter(Boolean).join(', ') || 'no tabs';
    record('Google Sheets', 'pass', `opened "${res.data.properties?.title ?? 'untitled'}"; tabs: ${sheetNames}`);
  } catch (err) {
    record('Google Sheets', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkCalendar(): Promise<void> {
  if (!configured(env.GOOGLE_CALENDAR_ID)) {
    record('Google Calendar', 'skip', 'GOOGLE_CALENDAR_ID is not configured');
    return;
  }

  try {
    const calendar = google.calendar({
      version: 'v3',
      auth: getGoogleAuth(['https://www.googleapis.com/auth/calendar.readonly']),
    });
    const res = await (calendar.events.list as any)({
      calendarId: env.GOOGLE_CALENDAR_ID,
      maxResults: 5,
      singleEvents: true,
      orderBy: 'startTime',
    });
    record('Google Calendar', 'pass', `listed ${res.data.items?.length ?? 0} event(s) from configured calendar`);
  } catch (err) {
    record('Google Calendar', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkGmail(): Promise<void> {
  if (smtpConfigured()) {
    try {
      await verifySmtpConnection();
      record('Gmail', 'pass', `SMTP authenticated as ${env.GMAIL_SENDER_EMAIL ?? env.SMTP_USER}`);
    } catch (err) {
      record('Gmail', 'fail', `SMTP: ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (!configured(env.GMAIL_SENDER_EMAIL)) {
    record('Gmail', 'skip', 'GMAIL_SENDER_EMAIL is not configured');
    return;
  }

  try {
    const gmail = google.gmail({
      version: 'v1',
      auth: getGoogleAuth(['https://www.googleapis.com/auth/gmail.readonly'], env.GMAIL_SENDER_EMAIL),
    });
    const res = await (gmail.users.getProfile as any)({ userId: env.GMAIL_SENDER_EMAIL });
    record('Gmail', 'pass', `authenticated as ${res.data.emailAddress ?? env.GMAIL_SENDER_EMAIL}`);
  } catch (err) {
    record('Gmail', 'fail', `${err instanceof Error ? err.message : String(err)}. Service accounts need Workspace domain-wide delegation for Gmail.`);
  }
}

async function checkSlack(): Promise<void> {
  if (!configured(env.SLACK_BOT_TOKEN)) {
    record('Slack', 'skip', 'SLACK_BOT_TOKEN is placeholder/unset');
    return;
  }

  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
    });
    const body = await res.json() as { ok?: boolean; team?: string; user?: string; error?: string };
    if (!body.ok) throw new Error(body.error ?? 'auth.test failed');
    record('Slack', 'pass', `bot authenticated for team=${body.team ?? 'unknown'} user=${body.user ?? 'unknown'}`);
  } catch (err) {
    record('Slack', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkAiServer(): Promise<void> {
  try {
    const health = await fetch(`${env.AI_SERVER_URL}/health`);
    if (!health.ok) throw new Error(`health returned ${health.status}`);
    const body = await health.json() as { status?: string; nodes?: string[] };
    record('AI server health', 'pass', `status=${body.status ?? 'unknown'}; nodes=${body.nodes?.length ?? 0}`);
  } catch (err) {
    record('AI server health', 'fail', `${err instanceof Error ? err.message : String(err)}. Start ai-server first.`);
    return;
  }

  try {
    const url = new URL('/api/rag/search', env.AI_SERVER_URL);
    url.searchParams.set('q', 'lumbar MRI conservative therapy requirements');
    url.searchParams.set('payer_id', 'payer_a');
    url.searchParams.set('service_code', 'CPT-72148');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RAG search returned ${res.status}`);
    const rows = await res.json() as unknown[];
    record('AI server RAG', rows.length > 0 ? 'pass' : 'warn', `returned ${rows.length} policy clause(s)`);
  } catch (err) {
    record('AI server RAG', 'fail', err instanceof Error ? err.message : String(err));
  }

  try {
    const res = await fetch(`${env.AI_SERVER_URL}/api/eval/results`);
    if (!res.ok) throw new Error(`eval results returned ${res.status}`);
    const body = await res.json() as { metrics?: Record<string, unknown>; cases_evaluated?: number };
    record('AI server eval', 'pass', `cases=${body.cases_evaluated ?? 'unknown'}; routing=${body.metrics?.routing_accuracy ?? 'unknown'}`);
  } catch (err) {
    record('AI server eval', 'fail', err instanceof Error ? err.message : String(err));
  }
}

async function checkMcp(): Promise<void> {
  const client = new Client({ name: 'claimsure-connection-checker', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: resolve(serverRoot, 'node_modules/.bin/tsx'),
    args: [resolve(serverRoot, 'src/mcp/mcp-server.ts')],
    env: { ...process.env, DRY_RUN: 'true' },
    cwd: serverRoot,
  });

  try {
    await client.connect(transport);
    const list = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
    const toolNames = list.tools.map((tool) => tool.name).sort();
    const expected = ['case_update', 'denial_parse', 'evidence_scan', 'policy_search', 'send_notification'];
    const missing = expected.filter((name) => !toolNames.includes(name));
    record('MCP tools/list', missing.length === 0 ? 'pass' : 'fail', `tools=${toolNames.join(', ')}${missing.length ? `; missing=${missing.join(', ')}` : ''}`);

    const call = await client.request({
      method: 'tools/call',
      params: {
        name: 'policy_search',
        arguments: {
          query: 'lumbar MRI conservative therapy requirements',
          payer_id: 'payer_a',
          service_code: 'CPT-72148',
        },
      },
    }, CallToolResultSchema);

    const text = call.content.find((item) => item.type === 'text')?.text ?? '{}';
    const parsed = JSON.parse(text) as { found?: boolean; results?: unknown[]; error?: string };
    record('MCP policy_search call', parsed.found ? 'pass' : 'warn', parsed.found ? `returned ${parsed.results?.length ?? 0} cited result(s)` : (parsed.error ?? 'no results'));

    const fakeCaseId = randomUUID();
    const evidence = await client.request({
      method: 'tools/call',
      params: {
        name: 'evidence_scan',
        arguments: {
          case_id: fakeCaseId,
          required_document_types: ['denial_letter', 'clinical_note'],
        },
      },
    }, CallToolResultSchema);
    const evidenceText = evidence.content.find((item) => item.type === 'text')?.text ?? '{}';
    const evidenceParsed = JSON.parse(evidenceText) as { error?: string; has_gap?: boolean };
    record('MCP evidence_scan call', evidenceParsed.error ? 'fail' : 'pass', evidenceParsed.error ?? `synthetic case checked; has_gap=${evidenceParsed.has_gap}`);
  } catch (err) {
    record('MCP stdio server', 'fail', err instanceof Error ? err.message : String(err));
  } finally {
    await transport.close().catch(() => {});
  }
}

function checkWorkflowWiring(): void {
  record(
    'Expected upload -> Drive -> RAG workflow',
    'warn',
    'REST document upload stores Drive metadata only; no backend endpoint currently uploads bytes to Drive and no RAG path downloads Drive file content for analysis.',
  );
  record(
    'AI multi-app action execution',
    'warn',
    'Python act node records Sheets/Gmail/Slack/Calendar actions, but does not execute app APIs; TypeScript services execute real APIs when called by REST/MCP.',
  );
}

async function main(): Promise<void> {
  console.log('Claimsure service connection check');
  console.log(`DRY_RUN=${env.DRY_RUN}`);
  console.log(`Google auth mode=${getGoogleAuthMode()}`);
  console.log('');

  await checkSupabase();
  await checkDrive();
  await checkSheets();
  await checkCalendar();
  await checkGmail();
  await checkSlack();
  await checkAiServer();
  await checkMcp();
  checkWorkflowWiring();

  const fails = results.filter((r) => r.status === 'fail').length;
  const warnings = results.filter((r) => r.status === 'warn').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const passes = results.filter((r) => r.status === 'pass').length;

  console.log('');
  console.log(`Summary: ${passes} pass, ${warnings} warn, ${skipped} skip, ${fails} fail`);
  process.exitCode = fails > 0 ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
