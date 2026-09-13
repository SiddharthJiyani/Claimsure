/**
 * mail.ts — Nodemailer-based email service for Claimsure.
 *
 * Single email dispatch point. Clearly separates:
 *   - Emails TO patients (claim status, rejection reasons, appeal updates)
 *   - Emails TO insurance providers (analysis ready, appeal received)
 */

import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

// ─── Transport ────────────────────────────────────────────────────────────────

function createTransport(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export function isMailConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export interface MailPayload {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  /** Who the email is going to — for logging clarity */
  recipientType: "patient" | "insurance_provider";
}

export async function sendMail(payload: MailPayload): Promise<{ messageId: string }> {
  if (env.DRY_RUN) {
    logger.debug("[mail] DRY_RUN — skipping send", { to: payload.to, subject: payload.subject });
    return { messageId: "DRY_RUN" };
  }
  const transport = createTransport();
  if (!transport) {
    logger.warn("[mail] SMTP not configured — email not sent", { to: payload.to });
    return { messageId: "NOT_CONFIGURED" };
  }
  try {
    const from = env.GMAIL_SENDER_EMAIL ?? env.SMTP_USER ?? "noreply@claimsure.app";
    const res = await transport.sendMail({
      from: `Claimsure <${from}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.htmlBody,
      text: payload.textBody,
    });
    logger.info("[mail] Email sent", { to: payload.to, messageId: res.messageId, recipientType: payload.recipientType });
    return { messageId: res.messageId };
  } catch (err) {
    logger.error("[mail] Send failed", err);
    throw new Error("Failed to send email");
  }
}

// ─── Templates — TO Patient ───────────────────────────────────────────────────

export function buildClaimReceivedEmail(p: {
  patientName: string; caseNumber: string; serviceType: string; insurerName: string;
}): Omit<MailPayload, "to"> {
  return {
    recipientType: "patient",
    subject: `Your claim ${p.caseNumber} has been received — Claimsure`,
    textBody: `Hi ${p.patientName}, your claim for ${p.serviceType} was submitted to ${p.insurerName} and is under review.`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 36px;">Claim Received</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.patientName}</strong>,</p>
        <p style="color:#94a3b8;">Your claim for <strong style="color:#e2e8f0;">${p.serviceType}</strong> was submitted to <strong style="color:#e2e8f0;">${p.insurerName}</strong> and is now under review.</p>
        <div style="background:#1e1e3a;border:1px solid #2d2d5a;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6366f1;font-weight:600;">Case Reference</p>
          <p style="margin:0;font-size:20px;font-weight:700;font-family:monospace;color:#fff;">${p.caseNumber}</p>
        </div>
        <p style="color:#94a3b8;">You will be notified when the insurer makes a decision.</p>
        ${footer()}
      </div>`),
  };
}

export function buildClaimAnalysisReadyEmail(p: {
  patientName: string; caseNumber: string; serviceType: string; analysisSummary: string; confidence?: number | undefined;
}): Omit<MailPayload, "to"> {
  return {
    recipientType: "patient",
    subject: `Analysis complete for case ${p.caseNumber} — Claimsure`,
    textBody: `Hi ${p.patientName}, the AI analysis for ${p.caseNumber} is complete. Summary: ${p.analysisSummary}`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#0891b2,#6366f1);padding:28px 36px;">Analysis Complete</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.patientName}</strong>,</p>
        <p style="color:#94a3b8;">The AI-powered analysis for case <strong style="color:#e2e8f0;">${p.caseNumber}</strong> (${p.serviceType}) is complete and sent to your insurer for decision.</p>
        <div style="background:#1e1e3a;border:1px solid #2d2d5a;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#0891b2;font-weight:600;">Analysis Summary</p>
          <p style="margin:0;color:#e2e8f0;line-height:1.6;font-size:14px;">${p.analysisSummary}</p>
          ${p.confidence ? `<p style="margin:10px 0 0;font-size:12px;color:#64748b;">Policy match: <strong style="color:#0891b2;">${Math.round(p.confidence*100)}%</strong></p>` : ""}
        </div>
        <p style="color:#94a3b8;">Your insurer will <strong style="color:#22c55e;">accept</strong> or <strong style="color:#ef4444;">reject</strong> your claim. You'll be notified immediately.</p>
        ${footer()}
      </div>`),
  };
}

export function buildClaimDecisionEmail(p: {
  patientName: string; caseNumber: string; serviceType: string;
  decision: "ACCEPTED" | "REJECTED"; decisionReason: string; insurerName?: string | undefined;
}): Omit<MailPayload, "to"> {
  const ok = p.decision === "ACCEPTED";
  const color = ok ? "#22c55e" : "#ef4444";
  const grad = ok ? "#059669,#0891b2" : "#dc2626,#9333ea";
  return {
    recipientType: "patient",
    subject: `Claim ${p.caseNumber} ${ok ? "approved" : "rejected"} — Claimsure`,
    textBody: `Hi ${p.patientName}, claim ${p.caseNumber} was ${p.decision.toLowerCase()}. Reason: ${p.decisionReason}`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,${grad});padding:28px 36px;">Claim ${ok ? "Accepted ✓" : "Rejected ✗"}</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.patientName}</strong>,</p>
        <p style="color:#94a3b8;">${p.insurerName ? `<strong style="color:#e2e8f0;">${p.insurerName}</strong> has made a decision on` : "A decision was made on"} your claim for <strong style="color:#e2e8f0;">${p.serviceType}</strong>.</p>
        <div style="background:#1e1e3a;border:2px solid ${color}40;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${color};font-weight:600;">Decision Reason</p>
          <p style="margin:0;color:#e2e8f0;line-height:1.6;font-size:14px;">${p.decisionReason}</p>
        </div>
        ${!ok ? `<div style="background:#1a1a0a;border:1px solid #854d0e40;border-radius:12px;padding:18px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#fbbf24;">Your Right to Appeal</p>
          <p style="margin:0;color:#94a3b8;line-height:1.6;font-size:13px;">If you disagree, you can file an appeal in your Claimsure dashboard using <strong style="color:#e2e8f0;">"Submit Appeal"</strong> on this claim. It will be re-evaluated against the policy.</p>
        </div>` : ""}
        ${footer()}
      </div>`),
  };
}

export function buildAppealSubmittedToPatientEmail(p: {
  patientName: string; caseNumber: string; serviceType: string;
}): Omit<MailPayload, "to"> {
  return {
    recipientType: "patient",
    subject: `Your appeal for case ${p.caseNumber} was received — Claimsure`,
    textBody: `Hi ${p.patientName}, your appeal for ${p.caseNumber} (${p.serviceType}) was received and is being reviewed.`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#d97706,#6366f1);padding:28px 36px;">Appeal Received</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.patientName}</strong>,</p>
        <p style="color:#94a3b8;">Your appeal for <strong style="color:#e2e8f0;">${p.serviceType}</strong> (case ${p.caseNumber}) was received and submitted to your insurer for review.</p>
        <p style="color:#94a3b8;">Your appeal will be evaluated against the insurer's policy documents. You'll be notified of the outcome.</p>
        ${footer()}
      </div>`),
  };
}

export function buildAppealDecisionEmail(p: {
  patientName: string; caseNumber: string; serviceType: string;
  decision: "ACCEPTED" | "REJECTED"; decisionReason: string;
}): Omit<MailPayload, "to"> {
  const ok = p.decision === "ACCEPTED";
  const color = ok ? "#22c55e" : "#ef4444";
  const grad = ok ? "#059669,#0891b2" : "#dc2626,#9333ea";
  return {
    recipientType: "patient",
    subject: `Appeal outcome for case ${p.caseNumber} — Claimsure`,
    textBody: `Hi ${p.patientName}, your appeal for ${p.caseNumber} was ${p.decision.toLowerCase()}. Reason: ${p.decisionReason}`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,${grad});padding:28px 36px;">Appeal ${ok ? "Accepted ✓" : "Rejected ✗"}</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.patientName}</strong>,</p>
        <p style="color:#94a3b8;">The insurer made a final decision on your appeal for <strong style="color:#e2e8f0;">${p.serviceType}</strong>.</p>
        <div style="background:#1e1e3a;border:2px solid ${color}40;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${color};font-weight:600;">Decision Reason</p>
          <p style="margin:0;color:#e2e8f0;line-height:1.6;font-size:14px;">${p.decisionReason}</p>
        </div>
        ${footer()}
      </div>`),
  };
}

// ─── Templates — TO Insurance Provider ───────────────────────────────────────

export function buildAnalysisReadyForInsurerEmail(p: {
  insurerName: string; caseNumber: string; serviceType: string; analysisSummary: string;
  confidence?: number | undefined; patientName?: string | undefined; dashboardUrl?: string | undefined;
}): Omit<MailPayload, "to"> {
  const url = p.dashboardUrl ?? "http://localhost:3000/insurance";
  return {
    recipientType: "insurance_provider",
    subject: `[Action Required] Claim analysis ready — Case ${p.caseNumber}`,
    textBody: `Hi ${p.insurerName}, the AI analysis for ${p.caseNumber} (${p.serviceType}) is ready. Please log in and Accept or Reject.`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px;">Claim Analysis Ready — Action Required</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.insurerName}</strong>,</p>
        <p style="color:#94a3b8;">The AI analysis for case <strong style="color:#e2e8f0;">${p.caseNumber}</strong> (${p.serviceType}${p.patientName ? `, Patient: ${p.patientName}` : ""}) is complete. Your decision is required.</p>
        <div style="background:#1e1e3a;border:1px solid #4f46e540;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#818cf8;font-weight:600;">Analysis Summary</p>
          <p style="margin:0 0 10px;color:#e2e8f0;line-height:1.6;font-size:14px;">${p.analysisSummary}</p>
          ${p.confidence ? `<p style="margin:0;font-size:12px;color:#64748b;">Policy match: <strong style="color:#818cf8;">${Math.round(p.confidence*100)}%</strong></p>` : ""}
        </div>
        <p style="color:#94a3b8;font-size:13px;">As the insurance provider, you must make the final decision: <strong style="color:#22c55e;">Accept</strong> or <strong style="color:#ef4444;">Reject</strong> the claim.</p>
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px;">Open Dashboard →</a>
        ${footer()}
      </div>`),
  };
}

export function buildAppealReceivedByInsurerEmail(p: {
  insurerName: string; caseNumber: string; serviceType: string; appealText: string;
  patientName?: string | undefined; dashboardUrl?: string | undefined;
}): Omit<MailPayload, "to"> {
  const url = p.dashboardUrl ?? "http://localhost:3000/insurance";
  return {
    recipientType: "insurance_provider",
    subject: `[Appeal Received] Patient appeal — Case ${p.caseNumber}`,
    textBody: `Hi ${p.insurerName}, a patient filed an appeal for ${p.caseNumber} (${p.serviceType}). Log in to review.`,
    htmlBody: wrap(`
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;background:linear-gradient(135deg,#b45309,#6366f1);padding:28px 36px;">Patient Appeal Filed</h1>
      <div style="padding:28px 36px;">
        <p>Hi <strong>${p.insurerName}</strong>,</p>
        <p style="color:#94a3b8;">${p.patientName ? `<strong style="color:#e2e8f0;">${p.patientName}</strong>` : "A patient"} filed an appeal for case <strong style="color:#e2e8f0;">${p.caseNumber}</strong> (${p.serviceType}).</p>
        <div style="background:#1e1e3a;border:1px solid #b4530940;border-radius:12px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#fbbf24;font-weight:600;">Appeal Statement</p>
          <p style="margin:0;color:#e2e8f0;line-height:1.6;font-size:14px;">${p.appealText}</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">The appeal was evaluated against your policy by AI. Please review and make a final determination.</p>
        <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px;">Review Appeal →</a>
        ${footer()}
      </div>`),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrap(inner: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f1a;color:#e2e8f0;border-radius:16px;overflow:hidden;">${inner}</div>`;
}

function footer(): string {
  return `<p style="margin:28px 0 0;font-size:12px;color:#475569;">This is an automated notification from Claimsure. Do not reply to this email.</p>`;
}
