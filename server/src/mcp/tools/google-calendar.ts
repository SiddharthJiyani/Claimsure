import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createAppealDeadlineEvent } from '../../services/google-calendar.js';
import { logger } from '../../lib/logger.js';

export function googleCalendarTools(server: McpServer): void {
  server.tool(
    'google_calendar_create_deadline',
    'Create an appeal deadline event in the configured Google Calendar.',
    {
      case_number: z.string().min(1),
      summary: z.string().optional(),
      description: z.string().optional(),
      deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Deadline date in YYYY-MM-DD format.'),
      attendee_emails: z.array(z.string().email()).optional(),
    },
    async ({ case_number, summary, description, deadline, attendee_emails }) => {
      try {
        const event = await createAppealDeadlineEvent({
          summary: summary ?? `Appeal Deadline: ${case_number}`,
          ...(description !== undefined ? { description } : {}),
          startDate: deadline,
          ...(attendee_emails !== undefined ? { attendeeEmails: attendee_emails } : {}),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: event.id !== 'ERROR' && event.id !== 'NOT_CONFIGURED',
                event,
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP google_calendar_create_deadline failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Google Calendar event creation failed' }) }],
          isError: true,
        };
      }
    },
  );
}
