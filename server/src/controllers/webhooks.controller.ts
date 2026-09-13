/**
 * Webhooks controller — handles Slack interactive component payloads.
 * Slack sends POST requests here when users click approval buttons.
 * Signature verification is handled by the Slack middleware.
 */

import type { Request, Response, NextFunction } from "express";
import { getCaseById, updateCaseStatus } from "../database/queries/cases.js";
import {
  getAppealByCase,
  updateAppealStatus,
} from "../database/queries/appeals.js";
import { createAuditLog } from "../database/queries/audit.js";
import { notifyPatient } from "../services/notifications.js";
import { sendSuccess } from "../lib/response.js";
import { logger } from "../lib/logger.js";

interface SlackActionPayload {
  type: string;
  actions: Array<{
    action_id: string;
    value: string;
  }>;
  user: {
    id: string;
    name: string;
  };
}

interface ApprovalValue {
  caseId: string;
  action: "approved" | "rejected" | "more_info";
}

// ─── Slack Interaction Handler ────────────────────────────────────────────────

export async function handleSlackInteraction(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Slack sends the payload as URL-encoded form data
    const rawPayload = (req.body as { payload?: string }).payload;
    if (!rawPayload) {
      res.status(200).json({ ok: true });
      return;
    }

    const payload = JSON.parse(rawPayload) as SlackActionPayload;

    if (payload.type !== "block_actions") {
      res.status(200).json({ ok: true });
      return;
    }

    const action = payload.actions[0];
    if (!action) {
      res.status(200).json({ ok: true });
      return;
    }

    const { caseId, action: decision } = JSON.parse(
      action.value,
    ) as ApprovalValue;

    logger.info("Slack approval action received", {
      caseId,
      decision,
      slackUser: payload.user.name,
    });

    // Process the decision
    const caseData = await getCaseById(caseId);
    const appeal = await getAppealByCase(caseId);

    if (decision === "approved" && appeal) {
      await updateAppealStatus(appeal.id, "APPROVED");
      await updateCaseStatus(caseId, "SUBMITTED");

      await createAuditLog({
        case_id: caseId,
        actor_type: "human",
        action: "appeal_approved_via_slack",
        human_decision: "approved",
        new_state: "SUBMITTED",
        metadata: {
          slack_user: payload.user.name,
          slack_user_id: payload.user.id,
        },
      });

      notifyPatient(
        caseData.patient_id,
        caseId,
        "appeal_submitted",
        "Your Appeal Has Been Submitted",
        `Great news! Your appeal for case ${caseData.case_number} has been approved and submitted.`,
        { caseNumber: caseData.case_number },
      ).catch(() => {});
    } else if (decision === "rejected" && appeal) {
      await updateAppealStatus(appeal.id, "REJECTED");
      await updateCaseStatus(caseId, "AWAITING_REVIEW");

      await createAuditLog({
        case_id: caseId,
        actor_type: "human",
        action: "appeal_rejected_via_slack",
        human_decision: "rejected",
        new_state: "AWAITING_REVIEW",
        metadata: { slack_user: payload.user.name },
      });
    } else if (decision === "more_info") {
      await updateCaseStatus(caseId, "ACTION_REQUIRED");

      await createAuditLog({
        case_id: caseId,
        actor_type: "human",
        action: "more_info_requested_via_slack",
        human_decision: "more_info",
        new_state: "ACTION_REQUIRED",
        metadata: { slack_user: payload.user.name },
      });

      notifyPatient(
        caseData.patient_id,
        caseId,
        "action_required",
        "Additional Information Needed",
        `The reviewer for case ${caseData.case_number} has requested more information.`,
        { caseNumber: caseData.case_number },
      ).catch(() => {});
    }

    // Respond 200 immediately to Slack (required within 3 seconds)
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error("Slack webhook error", err);
    // Always return 200 to Slack to prevent retries
    res.status(200).json({ ok: true });
    next(err);
  }
}

// ─── Generic Webhook Health ────────────────────────────────────────────────────

export async function webhookHealth(
  _req: Request,
  res: Response,
): Promise<void> {
  sendSuccess(res, { webhook: "ok" });
}

export async function sendSlackTest(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sendChannelUpdate, isSlackConfigured } = await import(
      "../services/slack.js"
    );
    if (!isSlackConfigured()) {
      res.status(400).json({
        error:
          "Slack incoming webhook is not configured. Adding the app to a channel is not enough.",
      });
      return;
    }
    await sendChannelUpdate({
      title: "ClaimSure is connected",
      message:
        "This is a test post from ClaimSure. Claim updates will appear in this channel.",
      event: "slack_test",
    });
    sendSuccess(res, { posted: true });
  } catch (err) {
    next(err);
  }
}
