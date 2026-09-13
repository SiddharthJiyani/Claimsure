import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { appendCaseRow, updateCaseRow } from '../../services/google-sheets.js';
import { logger } from '../../lib/logger.js';
import type { Case, CaseStatus } from '../../types/index.js';

const statusSchema = z.enum([
  'PENDING',
  'ANALYZING',
  'ACTION_REQUIRED',
  'AWAITING_REVIEW',
  'APPEAL_READY',
  'SUBMITTED',
  'VERIFYING',
  'RESOLVED',
  'ESCALATED',
  'CLOSED',
] as const);

function caseFromArgs(args: {
  case_id: string;
  case_number: string;
  status: CaseStatus;
  service_type: string;
  service_code?: string;
  patient_id: string;
  insurer_org_id: string;
  payer_id?: string;
}): Case {
  const now = new Date().toISOString();
  return {
    id: args.case_id,
    case_number: args.case_number,
    status: args.status,
    service_type: args.service_type,
    service_code: args.service_code ?? null,
    patient_id: args.patient_id,
    insurer_org_id: args.insurer_org_id,
    payer_id: args.payer_id ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function googleSheetsTools(server: McpServer): void {
  const schema = {
    case_id: z.string().uuid(),
    case_number: z.string().min(1),
    status: statusSchema,
    service_type: z.string().min(1),
    service_code: z.string().optional(),
    patient_id: z.string().uuid(),
    insurer_org_id: z.string().uuid(),
    payer_id: z.string().optional(),
  };

  server.tool(
    'google_sheets_append_case_row',
    'Append a case status row to the configured Google Sheets case mirror.',
    schema,
    async (args) => {
      try {
        const row = caseFromArgs(args);
        await appendCaseRow(row);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, action: 'append', case_number: row.case_number, status: row.status }) }],
        };
      } catch (err) {
        logger.error('MCP google_sheets_append_case_row failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Google Sheets append failed' }) }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'google_sheets_update_case_row',
    'Update an existing case row in the configured Google Sheets case mirror, appending if missing.',
    schema,
    async (args) => {
      try {
        const row = caseFromArgs(args);
        await updateCaseRow(row);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, action: 'update', case_number: row.case_number, status: row.status }) }],
        };
      } catch (err) {
        logger.error('MCP google_sheets_update_case_row failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Google Sheets update failed' }) }],
          isError: true,
        };
      }
    },
  );
}
