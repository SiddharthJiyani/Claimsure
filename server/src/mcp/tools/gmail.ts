import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { sendEmail } from '../../services/gmail.js';
import { logger } from '../../lib/logger.js';

export function gmailTools(server: McpServer): void {
  server.tool(
    'gmail_send_email',
    'Send an email through the configured Gmail API or SMTP fallback.',
    {
      to: z.union([z.string().email(), z.array(z.string().email())]),
      subject: z.string().min(1),
      html_body: z.string().min(1),
      text_body: z.string().optional(),
    },
    async ({ to, subject, html_body, text_body }) => {
      try {
        const result = await sendEmail({
          to,
          subject,
          htmlBody: html_body,
          ...(text_body !== undefined ? { textBody: text_body } : {}),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: true, message_id: result.messageId }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP gmail_send_email failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Gmail/SMTP send failed' }) }],
          isError: true,
        };
      }
    },
  );
}
