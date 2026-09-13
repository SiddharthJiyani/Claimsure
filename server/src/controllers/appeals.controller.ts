/**
 * Appeals controller — create, view, approve/reject, and submit appeals.
 * AI-generated appeals flow in via agent; human reviews/approves via this API.
 */

import type { Request, Response, NextFunction } from "express";
import { getCaseById, updateCaseStatus } from "../database/queries/cases.js";
import {
  getAppealByCase,
  createAppeal,
  updateAppealStatus,
  updateAppealText,
} from "../database/queries/appeals.js";
import { createAuditLog } from "../database/queries/audit.js";
import { createAppealDeadlineEvent } from "../services/google-calendar.js";
import {
  notifyPatient,
  notifyInsurersByOrg,
} from "../services/notifications.js";
import { sendSuccess, sendCreated } from "../lib/response.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../lib/errors.js";
import type {
  CreateAppealInput,
  UpdateAppealInput,
} from "../validators/appeals.validator.js";

// ─── Get Appeal for Case ──────────────────────────────────────────────────────

export async function getAppeal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;

    const caseData = await getCaseById(caseId);

    if (user.role === "patient" && caseData.patient_id !== user.id)
      throw new ForbiddenError();
    if (
      user.role === "insurance_provider" &&
      caseData.insurer_org_id !== user.organization_id
    ) {
      throw new ForbiddenError();
    }

    const appeal = await getAppealByCase(caseId);
    if (!appeal) throw new NotFoundError("Appeal");

    sendSuccess(res, appeal);
  } catch (err) {
    next(err);
  }
}

// ─── Create Appeal ────────────────────────────────────────────────────────────

export async function createNewAppeal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;
    const body = req.body as CreateAppealInput;

    if (user.role !== "insurance_provider") {
      throw new ForbiddenError("Only insurance providers can create appeals");
    }

    const caseData = await getCaseById(caseId);
    if (caseData.insurer_org_id !== user.organization_id)
      throw new ForbiddenError();

    // Only one active appeal per case
    const existing = await getAppealByCase(caseId);
    if (existing && !["REJECTED", "ACCEPTED"].includes(existing.status)) {
      throw new ConflictError("An active appeal already exists for this case");
    }

    const appeal = await createAppeal({
      case_id: caseId,
      ...(body.appeal_text !== undefined ? { appeal_text: body.appeal_text } : {}),
      ...(body.citations !== undefined ? { citations: body.citations } : {}),
    });

    // Update case status
    await updateCaseStatus(caseId, "APPEAL_READY");

    await createAuditLog({
      case_id: caseId,
      actor_id: user.id,
      actor_type: "human",
      action: "appeal_created",
      new_state: "APPEAL_READY",
      metadata: { appeal_id: appeal.id },
    });

    sendCreated(res, appeal, "Appeal created");
  } catch (err) {
    next(err);
  }
}

// ─── Update Appeal (Approve / Reject / Submit) ────────────────────────────────

export async function updateAppeal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;
    const appealId = req.params.appealId as string;
    const body = req.body as UpdateAppealInput;

    if (user.role !== "insurance_provider") {
      throw new ForbiddenError("Only insurance providers can update appeals");
    }

    const caseData = await getCaseById(caseId);
    if (caseData.insurer_org_id !== user.organization_id)
      throw new ForbiddenError();

    // Update text/citations if provided
    let updatedAppeal = await updateAppealStatus(
      appealId,
      body.status,
      body.status === "APPROVED" ? user.id : undefined,
    );

    if (body.appeal_text || body.citations) {
      updatedAppeal = await updateAppealText(
        appealId,
        body.appeal_text ?? updatedAppeal.appeal_text ?? "",
        body.citations,
      );
    }

    // Map appeal status to case status
    const caseStatusMap: Record<
      string,
      "SUBMITTED" | "AWAITING_REVIEW" | "CLOSED"
    > = {
      APPROVED: "SUBMITTED",
      REJECTED: "AWAITING_REVIEW",
      SUBMITTED: "SUBMITTED",
    };
    const newCaseStatus = caseStatusMap[body.status];
    if (newCaseStatus) await updateCaseStatus(caseId, newCaseStatus);

    await createAuditLog({
      case_id: caseId,
      actor_id: user.id,
      actor_type: "human",
      action: `appeal_${body.status.toLowerCase()}`,
      previous_state: caseData.status,
      new_state: newCaseStatus ?? caseData.status,
      human_decision: body.status,
      metadata: { appeal_id: appealId },
    });

    // Create Calendar event on submission
    if (body.status === "SUBMITTED") {
      createAppealDeadlineEvent({
        summary: `Appeal Submitted: ${caseData.case_number}`,
        description: `Appeal for case ${caseData.case_number} (${caseData.service_type}) has been submitted.`,
        startDate: new Date().toISOString().split("T")[0]!,
      }).catch(() => {});

      // Notify patient
      notifyPatient(
        caseData.patient_id,
        caseId,
        "appeal_submitted",
        "Your Appeal Has Been Submitted",
        `The appeal for case ${caseData.case_number} has been submitted to the payer.`,
        { caseNumber: caseData.case_number },
      ).catch(() => {});
    }

    sendSuccess(res, updatedAppeal, `Appeal ${body.status.toLowerCase()}`);
  } catch (err) {
    next(err);
  }
}
