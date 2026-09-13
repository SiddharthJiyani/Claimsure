import { Readable } from "stream";
import { google } from "googleapis";
import { googleDriveRootFolderId, googleOAuth } from "@/lib/env";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function driveClient() {
  const { clientId, clientSecret, redirectUri, refreshToken } = googleOAuth();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.",
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
}

function safeFolderName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "patient";
}

async function findOrCreateFolder(parentId: string, name: string) {
  const drive = driveClient();
  const escaped = name.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: `name = '${escaped}' and mimeType = '${FOLDER_MIME}' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) {
    throw new Error(`Could not create Drive folder "${name}"`);
  }
  return created.data.id;
}

export async function uploadPatientPrescription(input: {
  patientName: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}) {
  const rootId = googleDriveRootFolderId();
  if (!rootId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing from client/.env.local.");
  }

  const patientsFolderId = await findOrCreateFolder(rootId, "patients");
  const patientFolderId = await findOrCreateFolder(
    patientsFolderId,
    safeFolderName(input.patientName),
  );

  const drive = driveClient();
  const uploaded = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [patientFolderId],
    },
    media: {
      mimeType: input.mimeType || "application/octet-stream",
      body: Readable.from(input.content),
    },
    fields: "id, name, webViewLink, mimeType",
    supportsAllDrives: true,
  });

  if (!uploaded.data.id) {
    throw new Error("Google Drive did not return a file id");
  }

  return {
    drive_file_id: uploaded.data.id,
    drive_url: uploaded.data.webViewLink ?? null,
    folder: `patients/${safeFolderName(input.patientName)}`,
  };
}
