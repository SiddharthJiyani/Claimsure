import 'dotenv/config';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import { getGoogleAuth, getGoogleAuthMode } from '../services/google-auth.js';

async function main() {
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log('Google auth mode:', getGoogleAuthMode());
    const res = await drive.files.get({
      fileId: env.GOOGLE_DRIVE_FOLDER_ID!,
      supportsAllDrives: true,
      fields: 'id, name, driveId, parents, mimeType',
    });
    console.log('Folder name:', res.data.name);
    console.log('mimeType:', res.data.mimeType);
    const driveId = res.data.driveId;
    if (driveId) {
      console.log('driveId:', driveId);
      console.log('✅ This folder is inside a Shared Drive. Upload should work once the service account has Contributor access.');
    } else {
      console.log('driveId: (EMPTY)');
      console.log('');
      if (getGoogleAuthMode() === 'oauth2') {
        console.log('✅ This is a My Drive folder and OAuth2 is configured.');
        console.log('   Uploads should use your personal Drive quota.');
      } else {
        console.log('⛔ This is a My Drive folder — service accounts CANNOT upload here.');
        console.log('   Configure GOOGLE_OAUTH_* for personal Gmail, or use a Workspace Shared Drive.');
      }
    }
  } catch(e: any) {
    console.error('Error reading folder metadata:', e.message);
  }
}

main();
