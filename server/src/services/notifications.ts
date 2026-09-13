/**
 * Notification engine — routes notifications to the correct channel(s).
 * This is the single entry point for all notifications across the app.
 * Services and controllers call this; it decides what to send where.
 */

import { createNotification } from "../database/queries/notifications.js";
import { getProfileById } from "../database/queries/profiles.js";
import * as gmailService from "./gmail.js";
import * as slackService from "./slack.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import type { NotificationType } from "../types/index.js";

export interface NotifyParams {
  userId: string; // recipient user
  caseId?: string;
  type: NotificationType;
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
  };
}

/**
 * notify — the main function. Creates in-app notification and dispatches
 * to email and/or Slack based on the event type and recipient role.
 */
export async function notify(params: NotifyParams): Promise<void> {
  const { userId, caseId, type, title, message, metadata = {} } = params;

  // Always create in-app notification
  try {
    await createNotification({
      user_id: userId,
      ...(caseId !== undefined ? { case_id: caseId } : {}),
      type,
      title,
      message,
      channel: "in_app",
    });
  } catch (err) {
    logger.error("Failed to create in-app notification", err);
  }

  // Get user's role to decide channels
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

  // ─── Email Channel ───────────────────────────────────────────────────────
  const emailEvents: NotificationType[] = [
    "case_update",
    "action_required",
    "appeal_submitted",
    "case_resolved",
  ];

  if (emailEvents.includes(type) && email) {
    try {
      if (type === "action_required" && metadata.missingDocs) {
        const template = gmailService.buildActionRequiredEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          missingDocs: metadata.missingDocs,
          ...(metadata.deadline !== undefined ? { deadline: metadata.deadline } : {}),
        });
        await gmailService.sendEmail({ to: email, ...template });
      } else {
        const template = gmailService.buildCaseUpdateEmail({
          patientName: fullName,
          caseNumber: metadata.caseNumber ?? "",
          status: type.toUpperCase(),
          message,
        });
        await gmailService.sendEmail({ to: email, ...template });
      }

      await createNotification({
        user_id: userId,
        ...(caseId !== undefined ? { case_id: caseId } : {}),
        type,
        title,
        message,
        channel: "email",
      });
    } catch (err) {
      logger.error("Email notification failed", err);
    }
  }

  // ─── Slack Channel ────────────────────────────────────────────────────────
  // Slack is for insurance_provider only (approval requests, escalations)
  const slackInsuranceEvents: NotificationType[] = [
    "approval_request",
    "escalation",
  ];

  if (role === "insurance_provider" && slackInsuranceEvents.includes(type)) {
    try {
      if (type === "approval_request" && metadata.caseNumber && caseId) {
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
        type,
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
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotifyParams["metadata"],
): Promise<void> {
  return notify({ userId: patientId, caseId, type, title, message, ...(metadata !== undefined ? { metadata } : {}) });
}

/**
 * notifyInsurersByOrg — notifies all insurance_provider users in an org.
 * Used for case-level events where any reviewer in the org should be notified.
 */
export async function notifyInsurersByOrg(
  orgId: string,
  caseId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotifyParams["metadata"],
): Promise<void> {
  // Only fetch users from DB — no hardcoded IDs
  const { getProfilesByOrg } = await import("../database/queries/profiles.js");

  try {
    const profiles = await getProfilesByOrg(orgId);
    const insurers = profiles.filter((p) => p.role === "insurance_provider");

    await Promise.allSettled(
      insurers.map((p) =>
        notify({ userId: p.id, caseId, type, title, message, ...(metadata !== undefined ? { metadata } : {}) }),
      ),
    );
  } catch (err) {
    logger.error("Failed to notify insurers by org", err, { orgId });
  }
}

// Re-export env for DRY_RUN visibility
export { env };
