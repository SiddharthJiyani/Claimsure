/**
 * MCP Tool: case_update
 * Updates case status in Supabase and mirrors to Google Sheets.
 * Uses idempotency key to prevent duplicate updates.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCaseById, updateCaseStatus } from '../../database/queries/cases.js';
import { createAuditLog } from '../../database/queries/audit.js';
import { updateCaseRow } from '../../services/google-sheets.js';
import { supabase } from '../../database/supabase.js';
import { logger } from '../../lib/logger.js';
import type { CaseStatus } from '../../types/index.js';

const VALID_STATUSES: CaseStatus[] = [
  'PENDING', 'ANALYZING', 'ACTION_REQUIRED', 'AWAITING_REVIEW',
  'APPEAL_READY', 'SUBMITTED', 'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED',
];

export function caseUpdateTool(server: McpServer): void {
  server.tool(
    'case_update',
    'Update case status in the database and sync to Google Sheets. Idempotent.',
    {
      case_id: z.string().uuid().describe('The UUID of the case to update'),
      status: z
        .enum(['PENDING', 'ANALYZING', 'ACTION_REQUIRED', 'AWAITING_REVIEW',
               'APPEAL_READY', 'SUBMITTED', 'VERIFYING', 'RESOLVED', 'ESCALATED', 'CLOSED'])
        .describe('New case status'),
      reason: z.string().optional().describe('Reason for the status change (stored in audit log)'),
      idempotency_key: z
        .string()
        .optional()
        .describe('Idempotency key to prevent duplicate updates. Format: <case_id>:<action>'),
    },
    async ({ case_id, status, reason, idempotency_key }) => {
      try {
        // Check idempotency
        if (idempotency_key) {
          const { data: existing } = await supabase
            .from('idempotency_keys')
            .select('response')
            .eq('key', idempotency_key)
            .maybeSingle();

          if (existing) {
            logger.debug('MCP case_update idempotency hit', { idempotency_key });
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({ ...existing.response as object, replayed: true }),
                },
              ],
            };
          }
        }

        const previousCase = await getCaseById(case_id);
        const updated = await updateCaseStatus(case_id, status as CaseStatus);

        // Audit log
        await createAuditLog({
          case_id,
          actor_type: 'agent',
          action: 'status_updated_by_agent',
          previous_state: previousCase.status,
          new_state: status,
          idempotency_key,
          metadata: { reason },
        });

        // Mirror to Sheets (non-blocking)
        updateCaseRow(updated).catch(() => {});

        const result = {
          success: true,
          case_id,
          previous_status: previousCase.status,
          new_status: status,
          updated_at: updated.updated_at,
        };

        // Cache idempotency result
        if (idempotency_key) {
          supabase
            .from('idempotency_keys')
            .upsert({ key: idempotency_key, response: result }, { onConflict: 'key' })
            .then(() => {})
            .catch(() => {});
        }

        logger.info('MCP case_update completed', { case_id, status });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        logger.error('MCP case_update failed', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Case update failed', case_id }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
