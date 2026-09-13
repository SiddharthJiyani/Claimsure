/**
 * MCP Tool: policy-search
 * Searches payer policy documents via the ai-server RAG pipeline.
 * Returns matching policy clauses with citation IDs for hallucination prevention.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ragSearch } from '../../services/ai-client.js';
import { logger } from '../../lib/logger.js';

export function policySearchTool(server: McpServer): void {
  server.tool(
    'policy_search',
    'Search payer policy documents using semantic similarity. Returns matching clauses with citation IDs.',
    {
      query: z.string().min(1).describe('Natural language query about payer requirements or coverage criteria'),
      payer_id: z.string().optional().describe('Payer identifier to scope the search (e.g. "payer_a")'),
      service_code: z.string().optional().describe('CPT or procedure code to filter relevant policies'),
    },
    async ({ query, payer_id, service_code }) => {
      try {
        const results = await ragSearch(query, payer_id, service_code);

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  found: false,
                  results: [],
                  message: 'No matching policy clauses found. Agent should abstain rather than guess.',
                }),
              },
            ],
          };
        }

        logger.debug('MCP policy_search completed', { query, resultCount: results.length });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                found: true,
                results: results.map((r) => ({
                  citation_id: `${r.policy_id}::${r.clause}`,
                  policy_id: r.policy_id,
                  clause: r.clause,
                  text: r.text,
                  relevance_score: r.score,
                })),
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP policy_search failed', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Policy search unavailable', found: false, results: [] }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
