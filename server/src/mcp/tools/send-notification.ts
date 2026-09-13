/**
 * MCP Tool: send_notification
 * Dispatches a multi-channel notification via the notifications engine.
 * Reuses the same service as the REST API — no duplicated logic.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { notify } from '../../services/notifications.js';
import { logger } from '../../lib/logger.js';

export function sendNotificationTool(server: McpServer): void {
  server.tool(
    'send_notification',
    'Send a notification to a user via in-app, email, or Slack channels based on their role and the event type.',
    {
      user_id: z.string().uuid().describe('UUID of the recipient user'),
      case_id: z.string().uuid().optional().describe('UUID of the related case'),
      type: z
        .enum([
          'case_update',
          'action_required',
          'approval_request',
          'appeal_submitted',
          'case_resolved',
          'escalation',
        ])
        .describe('Notification type — determines channel routing and email template'),
      title: z.string().min(1).describe('Notification title'),
      message: z.string().min(1).describe('Notification message body'),
      metadata: z
        .object({
          caseNumber: z.string().optional(),
          missingDocs: z.array(z.string()).optional(),
          deadline: z.string().optional(),
          agentSummary: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
          denialReason: z.string().optional(),
          serviceType: z.string().optional(),
        })
        .optional()
        .describe('Optional metadata for template rendering'),
    },
    async ({ user_id, case_id, type, title, message, metadata }) => {
      try {
        await notify({
          userId: user_id,
          caseId: case_id,
          type,
          title,
          message,
          metadata,
        });

        logger.debug('MCP send_notification completed', { user_id, type });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                user_id,
                type,
                channels_attempted: ['in_app', 'email', 'slack'],
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP send_notification failed', err);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: 'Notification failed', user_id }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
