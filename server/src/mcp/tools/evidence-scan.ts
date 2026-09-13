/**
 * MCP Tool: evidence_scan
 * Scans Google Drive for documents related to a case.
 * Returns found evidence and flags missing items from a required list.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDocumentsByCase } from '../../database/queries/documents.js';
import { searchFiles } from '../../services/google-drive.js';
import { logger } from '../../lib/logger.js';

export function evidenceScanTool(server: McpServer): void {
  server.tool(
    'evidence_scan',
    'Scan available evidence for a case. Returns found documents and identifies missing required items.',
    {
      case_id: z.string().uuid().describe('The UUID of the case to scan evidence for'),
      required_document_types: z
        .array(z.string())
        .optional()
        .describe('List of required document types to check for (e.g. ["clinical_note", "mri_report"])'),
    },
    async ({ case_id, required_document_types }) => {
      try {
        // Fetch documents from Supabase metadata
        const documents = await getDocumentsByCase(case_id);

        const found = documents.filter((d) => !d.is_missing);
        const missing = documents.filter((d) => d.is_missing);

        // If required types provided, compute gap deterministically
        let gap: string[] = [];
        if (required_document_types && required_document_types.length > 0) {
          const foundTypes = new Set(found.map((d) => d.document_type));
          gap = required_document_types.filter((t) => !foundTypes.has(t as never));
        }

        logger.debug('MCP evidence_scan completed', {
          case_id,
          found: found.length,
          missing: missing.length,
          gap: gap.length,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                case_id,
                evidence_found: found.map((d) => ({
                  id: d.id,
                  name: d.name,
                  type: d.document_type,
                  drive_file_id: d.drive_file_id,
                  citation_id: `doc::${d.id}`,
                })),
                evidence_missing: missing.map((d) => ({
                  id: d.id,
                  name: d.name,
                  type: d.document_type,
                })),
                gap_from_requirements: gap,
                has_gap: gap.length > 0 || missing.length > 0,
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP evidence_scan failed', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Evidence scan failed', case_id }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
