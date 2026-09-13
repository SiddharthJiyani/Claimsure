import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import { ServiceUnavailableError } from '../lib/errors.js';

function usable(value?: string): value is string {
  return Boolean(
    value &&
      !value.includes('your_') &&
      !value.includes('placeholder') &&
      !value.includes('YOUR_'),
  );
}

export function googleOAuthConfigured(): boolean {
  return usable(env.GOOGLE_OAUTH_CLIENT_ID) &&
    usable(env.GOOGLE_OAUTH_CLIENT_SECRET) &&
    usable(env.GOOGLE_OAUTH_REFRESH_TOKEN);
}

export function googleServiceAccountConfigured(): boolean {
  if (!usable(env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)) return false;
  return existsSync(resolve(process.cwd(), env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH));
}

export function getGoogleAuth(scopes: string[], subject?: string): any {
  if (googleOAuthConfigured()) {
    const clientId = env.GOOGLE_OAUTH_CLIENT_ID as string;
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET as string;
    const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN as string;
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      env.GOOGLE_OAUTH_REDIRECT_URI,
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  if (googleServiceAccountConfigured()) {
    const keyFile = env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH as string;
    return new google.auth.GoogleAuth({
      keyFile,
      scopes,
      ...(subject ? { clientOptions: { subject } } : {}),
    });
  }

  throw new ServiceUnavailableError(
    'Google auth (configure GOOGLE_OAUTH_* for personal Gmail, or GOOGLE_SERVICE_ACCOUNT_KEY_PATH for Workspace/Shared Drive)',
  );
}

export function getGoogleAuthMode(): 'oauth2' | 'service_account' | 'not_configured' {
  if (googleOAuthConfigured()) return 'oauth2';
  if (googleServiceAccountConfigured()) return 'service_account';
  return 'not_configured';
}
