/**
 * MCP Tool: denial_parse
 * Downloads the denial letter from Google Drive and returns structured denial data.
 * Actual PDF text extraction is delegated to the ai-server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDenialsByCase } from '../../database/queries/denials.js';
import { downloadFileContent } from '../../services/google-drive.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';

export function denyParseTool(server: McpServer): void {
  server.tool(
    'denial_parse',
    'Retrieve structured denial information for a case. Returns denial code, reason, deadline, and raw text.',
    {
      case_id: z.string().uuid().describe('The UUID of the case to parse denial for'),
    },
    async ({ case_id }) => {
      try {
        const denials = await getDenialsByCase(case_id);

        if (denials.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ found: false, denial: null }),
              },
            ],
          };
        }

        // Return the most recent denial
        const denial = denials[0]!;

        // Optionally fetch raw PDF content if available and not DRY_RUN
        let rawContent: string | null = denial.raw_text ?? null;
        if (!rawContent && denial.drive_file_id && !env.DRY_RUN) {
          try {
            const buffer = await downloadFileContent(denial.drive_file_id);
            rawContent = `[PDF content available — ${buffer.length} bytes]`;
          } catch {
            rawContent = null;
          }
        }

        logger.debug('MCP denial_parse completed', { case_id, denialId: denial.id });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                found: true,
                denial: {
                  id: denial.id,
                  denial_code: denial.denial_code,
                  denial_reason: denial.denial_reason,
                  denial_date: denial.denial_date,
                  appeal_deadline: denial.appeal_deadline,
                  drive_file_id: denial.drive_file_id,
                  raw_text_available: !!rawContent,
                  raw_text: rawContent,
                },
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP denial_parse failed', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Failed to retrieve denial', found: false }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
