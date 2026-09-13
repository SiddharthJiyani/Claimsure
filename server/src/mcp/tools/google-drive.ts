import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listFilesInFolder, uploadFile } from '../../services/google-drive.js';
import { logger } from '../../lib/logger.js';

export function googleDriveTools(server: McpServer): void {
  server.tool(
    'google_drive_list_files',
    'List files from the configured Google Drive evidence folder.',
    {
      folder_id: z.string().optional().describe('Optional Drive folder ID. Defaults to GOOGLE_DRIVE_FOLDER_ID.'),
      limit: z.number().int().positive().max(50).default(10),
    },
    async ({ folder_id, limit }) => {
      try {
        const files = await listFilesInFolder(folder_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                files: files.slice(0, limit).map((file) => ({
                  id: file.id,
                  name: file.name,
                  mime_type: file.mimeType,
                  url: file.webViewLink,
                  created_time: file.createdTime,
                })),
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP google_drive_list_files failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Google Drive list failed' }) }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'google_drive_upload_text',
    'Upload a small text document to the configured Google Drive evidence folder.',
    {
      name: z.string().min(1).describe('File name to create in Drive.'),
      content: z.string().min(1).describe('Plain text content to upload.'),
      folder_id: z.string().optional().describe('Optional Drive folder ID. Defaults to GOOGLE_DRIVE_FOLDER_ID.'),
    },
    async ({ name, content, folder_id }) => {
      try {
        const file = await uploadFile({
          name,
          content,
          mimeType: 'text/plain',
          ...(folder_id !== undefined ? { folderId: folder_id } : {}),
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                file: {
                  id: file.id,
                  name: file.name,
                  mime_type: file.mimeType,
                  url: file.webViewLink,
                },
              }),
            },
          ],
        };
      } catch (err) {
        logger.error('MCP google_drive_upload_text failed', err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'Google Drive upload failed' }) }],
          isError: true,
        };
      }
    },
  );
}
