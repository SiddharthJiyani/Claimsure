import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';
import { env } from '../config/env.js';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

function requireOAuthClient() {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      'Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in server/.env first.',
    );
  }

  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function writeRefreshTokenToEnv(refreshToken: string): void {
  const envPath = resolve(process.cwd(), '.env');
  const current = readFileSync(envPath, 'utf8');
  const next = current.includes('GOOGLE_OAUTH_REFRESH_TOKEN=')
    ? current.replace(/GOOGLE_OAUTH_REFRESH_TOKEN=.*/g, `GOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}`)
    : `${current.trimEnd()}\nGOOGLE_OAUTH_REFRESH_TOKEN=${refreshToken}\n`;

  writeFileSync(envPath, next);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const oauth2 = requireOAuthClient();

  if (command === 'url') {
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });

    console.log('Open this URL, sign in with your Gmail account, approve access, then copy the code from the redirected URL.');
    console.log('');
    console.log(url);
    return;
  }

  if (command === 'token') {
    const code = argValue('code');
    if (!code) {
      throw new Error('Usage: pnpm google:oauth-token -- --code=PASTE_CODE_HERE');
    }

    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh token. Re-run the URL step; prompt=consent is required.');
    }

    if (hasFlag('write-env')) {
      writeRefreshTokenToEnv(tokens.refresh_token);
      console.log('GOOGLE_OAUTH_REFRESH_TOKEN written to server/.env');
      return;
    }

    console.log('Add this to server/.env:');
    console.log('');
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    return;
  }

  console.log('Usage:');
  console.log('  pnpm google:oauth-url');
  console.log('  pnpm google:oauth-token -- --code=PASTE_CODE_HERE');
  console.log('  pnpm google:oauth-token -- --code=PASTE_CODE_HERE --write-env');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
