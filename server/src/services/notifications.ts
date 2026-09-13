/**
 * Notification engine — routes notifications to the correct channel(s).
 * This is the single entry point for all notifications across the app.
 * Services and controllers call this; it decides what to send where.
 *
 * Clear separation:
 *   - Patient events   → in-app + email (Nodemailer/SMTP)
 *   - Insurer events   → in-app + email (Nodemailer/SMTP) + Slack (optional)
 */

import { createNotification } from "../database/queries/notifications.js";
import { getProfileById } from "../database/queries/profiles.js";
import * as mailService from "./mail.js";
import * as slackService from "./slack.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import type { NotificationType } from "../types/index.js";

export interface NotifyParams {
  userId: string;
  caseId?: string;
  type: NotificationType | "claim_decision" | "appeal_decision" | "appeal_received_by_insurer" | "analysis_ready_for_insurer";
  title: string;
  message: string;
  metadata?: {
    caseNumber?: string;
    missingDocs?: string[];
    deadline?: string;
    agentSummary?: string;
    confidence?: number;
    denialReason?: string;
    serviceType?: string;
    decision?: "ACCEPTED" | "REJECTED";
    decisionReason?: string;
    insurerName?: string;
    patientName?: string;
    appealText?: string;
  };
}

/**
 * notify — the main function. Creates in-app notification and dispatches
 * to email (Nodemailer SMTP) and/or Slack based on the event type.
 */
export async function notify(params: NotifyParams): Promise<void> {
  const { userId, caseId, type, title, message, metadata = {} } = params;

  // Always create in-app notification
  try {
    await createNotification({
      user_id: userId,
      ...(caseId !== undefined ? { case_id: caseId } : {}),
      type: (type as NotificationType) ?? "case_update",
      title,
      message,
      channel: "in_app",
    });
  } catch (err) {
    logger.error("Failed to create in-app notification", err);
  }

  // Load recipient profile
  let role: string = "patient";
  let email: string = "";
  let fullName: string = "";

  try {
    const profile = await getProfileById(userId);
    role = profile.role;
    email = profile.email;
    fullName = profile.full_name;
  } catch (err) {
    logger.warn("Could not load profile for notification routing", { userId });
  }

  if (!email) return;

  // ─── Email Dispatch ────────────────────────────────────────────────────────

  try {
    let template: Omit<mailService.MailPayload, "to"> | null = null;

    // Patient-targeted emails
    if (role === "patient") {
      if (type === "case_update" || type === "case_resolved") {
        template = mailService.buildClaimReceivedEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          insurerName: metadata.insurerName ?? "your insurance provider",
        });
      } else if (type === "action_required") {
        // Use existing approach for action_required — plain update
        template = {
          recipientType: "patient",
          subject: `Action Required: Case ${metadata.caseNumber ?? ""} — Claimsure`,
          textBody: message,
          htmlBody: mailService.buildClaimReceivedEmail({
            patientName: fullName,
            caseNumber: metadata.caseNumber ?? "",
            serviceType: metadata.serviceType ?? "",
            insurerName: metadata.insurerName ?? "your insurance provider",
          }).htmlBody,
        };
      } else if (type === "claim_decision" && metadata.decision) {
        template = mailService.buildClaimDecisionEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          decision: metadata.decision,
          decisionReason: metadata.decisionReason ?? message,
          insurerName: metadata.insurerName,
        });
      } else if (type === "appeal_submitted") {
        template = mailService.buildAppealSubmittedToPatientEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
        });
      } else if (type === "appeal_decision" && metadata.decision) {
        template = mailService.buildAppealDecisionEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          decision: metadata.decision,
          decisionReason: metadata.decisionReason ?? message,
        });
      } else if (type === "analysis_ready_for_insurer") {
        // Sent to patient after analysis — let them know insurer now needs to decide
        template = mailService.buildClaimAnalysisReadyEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          analysisSummary: metadata.agentSummary ?? message,
          confidence: metadata.confidence,
        });
      }
    }

    // Insurer-targeted emails
    if (role === "insurance_provider") {
      if (type === "analysis_ready_for_insurer" || type === "approval_request") {
        template = mailService.buildAnalysisReadyForInsurerEmail({
          insurerName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          analysisSummary: metadata.agentSummary ?? message,
          confidence: metadata.confidence,
          patientName: metadata.patientName,
        });
      } else if (type === "appeal_received_by_insurer" || type === "appeal_submitted") {
        template = mailService.buildAppealReceivedByInsurerEmail({
          insurerName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          appealText: metadata.appealText ?? message,
          patientName: metadata.patientName,
        });
      } else if (type === "escalation") {
        template = mailService.buildAnalysisReadyForInsurerEmail({
          insurerName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          serviceType: metadata.serviceType ?? "",
          analysisSummary: `⚠️ ESCALATED: ${metadata.agentSummary ?? message}`,
          confidence: metadata.confidence,
        });
      }
    }

    if (template && email) {
      await mailService.sendMail({ to: email, ...template });
      await createNotification({
        user_id: userId,
        ...(caseId !== undefined ? { case_id: caseId } : {}),
        type: (type as NotificationType) ?? "case_update",
        title,
        message,
        channel: "email",
      });
    }
  } catch (err) {
    logger.error("Email notification failed", err);
  }

  // ─── Slack Channel (Insurance Providers only) ─────────────────────────────
  const slackInsuranceEvents = ["approval_request", "escalation", "analysis_ready_for_insurer"];
  if (role === "insurance_provider" && slackInsuranceEvents.includes(type)) {
    try {
      if ((type === "approval_request" || type === "analysis_ready_for_insurer") && metadata.caseNumber && caseId) {
        await slackService.sendApprovalRequest({
          caseId,
          caseNumber: metadata.caseNumber,
          serviceType: metadata.serviceType ?? "",
          denialReason: metadata.denialReason ?? "",
          agentSummary: metadata.agentSummary ?? message,
          confidence: metadata.confidence ?? 0,
        });
      } else if (type === "escalation" && metadata.caseNumber && caseId) {
        await slackService.sendEscalationAlert({
          caseId,
          caseNumber: metadata.caseNumber,
          serviceType: metadata.serviceType ?? "",
          reason: message,
        });
      }
      await createNotification({
        user_id: userId,
        ...(caseId !== undefined ? { case_id: caseId } : {}),
        type: (type as NotificationType) ?? "case_update",
        title,
        message,
        channel: "slack",
      });
    } catch (err) {
      logger.error("Slack notification failed", err);
    }
  }

  logger.info("Notification dispatched", { userId, type, caseId });
}

/**
 * notifyPatient — convenience helper to notify a patient.
 */
export async function notifyPatient(
  patientId: string,
  caseId: string,
  type: NotifyParams["type"],
  title: string,
  message: string,
  metadata?: NotifyParams["metadata"],
): Promise<void> {
  return notify({ userId: patientId, caseId, type, title, message, ...(metadata !== undefined ? { metadata } : {}) });
}

/**
 * notifyInsurersByOrg — notifies all insurance_provider users in an org.
 */
export async function notifyInsurersByOrg(
  orgId: string,
  caseId: string,
  type: NotifyParams["type"],
  title: string,
  message: string,
  metadata?: NotifyParams["metadata"],
): Promise<void> {
  const { getProfilesByOrg } = await import("../database/queries/profiles.js");
  try {
    const profiles = await getProfilesByOrg(orgId);
    const insurers = profiles.filter((p) => p.role === "insurance_provider");
    await Promise.allSettled(
      insurers.map((p) => notify({ userId: p.id, caseId, type, title, message, ...(metadata !== undefined ? { metadata } : {}) })),
    );
  } catch (err) {
    logger.error("Failed to notify insurers by org", err, { orgId });
  }
}

export { env };
