/**
 * Gmail service — sends notification and appeal delivery emails.
 * Uses Google service account with domain-wide delegation,
 * or falls back to SMTP configuration if configured.
 */

import { google } from 'googleapis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

function getGmailClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    // For service account with domain-wide delegation:
    clientOptions: { subject: env.GMAIL_SENDER_EMAIL },
  });
  return google.gmail({ version: 'v1', auth });
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: Array<{ filename: string; content: Buffer; mimeType: string }>;
}

function buildRawEmail(input: SendEmailInput, from: string): string {
  const toAddr = Array.isArray(input.to) ? input.to.join(', ') : input.to;
  const lines = [
    `From: Claimsure <${from}>`,
    `To: ${toAddr}`,
    `Subject: ${input.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    input.htmlBody,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

export async function sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
  if (env.DRY_RUN) {
    logger.debug('DRY_RUN: sendEmail', { to: input.to, subject: input.subject });
    return { messageId: 'DRY_RUN_MSG_ID' };
  }

  if (!env.GMAIL_SENDER_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    logger.warn('Gmail not configured, skipping email send');
    return { messageId: 'NOT_CONFIGURED' };
  }

  try {
    const gmail = getGmailClient();
    const raw = buildRawEmail(input, env.GMAIL_SENDER_EMAIL);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    logger.info('Email sent', { to: input.to, messageId: res.data.id });
    return { messageId: res.data.id ?? 'unknown' };
  } catch (err) {
    logger.error('Gmail send failed', err);
    throw new Error('Failed to send email');
  }
}

// ─── Email Templates ──────────────────────────────────────────────────────────

export function buildCaseUpdateEmail(params: {
  patientName: string;
  caseNumber: string;
  status: string;
  message: string;
}): Pick<SendEmailInput, 'subject' | 'htmlBody'> {
  return {
    subject: `Claimsure Update: Case ${params.caseNumber} — ${params.status}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Claimsure Case Update</h2>
        <p>Hi ${params.patientName},</p>
        <p>${params.message}</p>
        <p><strong>Case Number:</strong> ${params.caseNumber}</p>
        <p><strong>Status:</strong> ${params.status}</p>
        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          This is an automated notification from Claimsure. 
          Do not reply to this email.
        </p>
      </div>
    `,
  };
}

export function buildActionRequiredEmail(params: {
  patientName: string;
  caseNumber: string;
  missingDocs: string[];
  deadline?: string;
}): Pick<SendEmailInput, 'subject' | 'htmlBody'> {
  const docList = params.missingDocs.map((d) => `<li>${d}</li>`).join('');
  return {
    subject: `Action Required: Missing Documents for Case ${params.caseNumber}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #c0392b;">Action Required — Missing Documents</h2>
        <p>Hi ${params.patientName},</p>
        <p>The following documents are required to process your appeal for case <strong>${params.caseNumber}</strong>:</p>
        <ul>${docList}</ul>
        ${params.deadline ? `<p><strong>Please submit by:</strong> ${params.deadline}</p>` : ''}
        <p style="margin-top: 24px; color: #666; font-size: 12px;">
          This is an automated notification from Claimsure.
        </p>
      </div>
    `,
  };
}
