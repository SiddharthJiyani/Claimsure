/**
 * Google Drive service — upload, list, search, and download files.
 * All files are stored in a shared Drive folder (GOOGLE_DRIVE_FOLDER_ID).
 * File metadata (drive_file_id + drive_url) is stored in Supabase; 
 * the actual binary content lives only in Drive.
 */

import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { ServiceUnavailableError } from '../lib/errors.js';

// ─── Auth ──────────────────────────────────────────────────────────────────────

function getDriveClient(): drive_v3.Drive {
  if (!env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    throw new ServiceUnavailableError('Google Drive (service account not configured)');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

// ─── DRY_RUN Fixtures ─────────────────────────────────────────────────────────

const DRY_RUN_FILE: DriveFile = {
  id: 'DRY_RUN_FILE_ID',
  name: 'dry-run-document.pdf',
  mimeType: 'application/pdf',
  webViewLink: 'https://drive.google.com/dry-run',
  size: '0',
  createdTime: new Date().toISOString(),
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  size: string | null;
  createdTime: string | null;
}

export interface UploadFileInput {
  name: string;
  mimeType: string;
  content: Buffer | string;
  folderId?: string;
}

// ─── Operations ───────────────────────────────────────────────────────────────

export async function uploadFile(input: UploadFileInput): Promise<DriveFile> {
  if (env.DRY_RUN) {
    logger.debug('DRY_RUN: uploadFile', { name: input.name });
    return { ...DRY_RUN_FILE, name: input.name };
  }

  try {
    const drive = getDriveClient();
    const folderId = input.folderId ?? env.GOOGLE_DRIVE_FOLDER_ID;

    const body = typeof input.content === 'string'
      ? Readable.from([input.content])
      : Readable.from(input.content);

    const res = await drive.files.create({
      requestBody: {
        name: input.name,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: input.mimeType,
        body,
      },
      fields: 'id, name, mimeType, webViewLink, size, createdTime',
    });

    logger.info('Drive file uploaded', { fileId: res.data.id, name: input.name });
    return res.data as DriveFile;
  } catch (err) {
    logger.error('Drive upload failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}

export async function getFileMetadata(fileId: string): Promise<DriveFile> {
  if (env.DRY_RUN) return { ...DRY_RUN_FILE, id: fileId };

  try {
    const drive = getDriveClient();
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, webViewLink, size, createdTime',
    });
    return res.data as DriveFile;
  } catch (err) {
    logger.error('Drive getMetadata failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}

export async function listFilesInFolder(folderId?: string): Promise<DriveFile[]> {
  if (env.DRY_RUN) return [DRY_RUN_FILE];

  try {
    const drive = getDriveClient();
    const targetFolder = folderId ?? env.GOOGLE_DRIVE_FOLDER_ID;

    if (!targetFolder) throw new ServiceUnavailableError('Google Drive (no folder configured)');

    const res = await drive.files.list({
      q: `'${targetFolder}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
      orderBy: 'createdTime desc',
    });

    return (res.data.files ?? []) as DriveFile[];
  } catch (err) {
    logger.error('Drive list failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}

export async function searchFiles(query: string, folderId?: string): Promise<DriveFile[]> {
  if (env.DRY_RUN) return [DRY_RUN_FILE];

  try {
    const drive = getDriveClient();
    const targetFolder = folderId ?? env.GOOGLE_DRIVE_FOLDER_ID;
    const folderClause = targetFolder ? ` and '${targetFolder}' in parents` : '';

    const res = await drive.files.list({
      q: `name contains '${query}'${folderClause} and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, size, createdTime)',
    });

    return (res.data.files ?? []) as DriveFile[];
  } catch (err) {
    logger.error('Drive search failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}

export async function downloadFileContent(fileId: string): Promise<Buffer> {
  if (env.DRY_RUN) return Buffer.from('DRY_RUN_CONTENT');

  try {
    const drive = getDriveClient();
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err) {
    logger.error('Drive download failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}

export async function deleteFile(fileId: string): Promise<void> {
  if (env.DRY_RUN) {
    logger.debug('DRY_RUN: deleteFile', { fileId });
    return;
  }

  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    logger.info('Drive file deleted', { fileId });
  } catch (err) {
    logger.error('Drive delete failed', err);
    throw new ServiceUnavailableError('Google Drive');
  }
}
