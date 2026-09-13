/**
 * Appeals controller — CORRECTED ROLE MODEL:
 *
 * PATIENT:
 *   - Can view their appeal (GET)
 *   - Can SUBMIT an appeal when their claim was REJECTED (POST)
 *
 * INSURANCE PROVIDER:
 *   - Can view appeals (GET) for their org's cases
 *   - Makes the final decision on appeals via /cases/:id/appeal-decision (in decisions.controller)
 *   - NOTE: Insurers do NOT create or manage appeals — patients do.
 *
 * The "Approve/Reject appeal" concept previously assigned to insurers is now
 * properly handled via the decisions.controller.ts makeAppealDecision endpoint.
 */

import type { Request, Response, NextFunction } from "express";
import { getCaseById, updateCaseStatus } from "../database/queries/cases.js";
import {
  getAppealByCase,
  createAppeal,
  updateAppealStatus,
} from "../database/queries/appeals.js";
import { createAuditLog } from "../database/queries/audit.js";
import { createAppealDeadlineEvent } from "../services/google-calendar.js";
import { notifyPatient, notifyInsurersByOrg } from "../services/notifications.js";
import * as sheetsService from "../services/google-sheets.js";
import { sendSuccess, sendCreated } from "../lib/response.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../lib/errors.js";
import { z } from "zod";
import { supabase } from "../database/supabase.js";

// ─── Validators ───────────────────────────────────────────────────────────────

export const submitAppealSchema = z.object({
  appeal_text: z.string().min(20, "Please describe your appeal in more detail (at least 20 characters)"),
  citations: z.array(z.object({
    policy_id: z.string(),
    clause: z.string(),
    text: z.string(),
  })).optional(),
});

export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;

// ─── Get Appeal ───────────────────────────────────────────────────────────────

export async function getAppeal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;

    const caseData = await getCaseById(caseId);

    // Role-based access
    if (user.role === "patient" && caseData.patient_id !== user.id)
      throw new ForbiddenError();
    if (user.role === "insurance_provider" && caseData.insurer_org_id !== user.organization_id)
      throw new ForbiddenError();

    const appeal = await getAppealByCase(caseId);
    if (!appeal) throw new NotFoundError("Appeal");

    sendSuccess(res, appeal);
  } catch (err) {
    next(err);
  }
}

// ─── Submit Appeal (Patient only) ─────────────────────────────────────────────

export async function submitPatientAppeal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;
    const body = req.body as SubmitAppealInput;

    if (user.role !== "patient") {
      throw new ForbiddenError("Only patients can submit an appeal");
    }

    const caseData = await getCaseById(caseId);

    if (caseData.patient_id !== user.id) {
      throw new ForbiddenError("You do not have access to this case");
    }

    // Patient can only appeal after a REJECTED decision (status AWAITING_REVIEW)
    if (!["AWAITING_REVIEW", "ACTION_REQUIRED"].includes(caseData.status)) {
      throw new ConflictError(
        "You can only submit an appeal for a claim that has been rejected or requires action",
      );
    }

    // Check for duplicate active appeal
    const existing = await getAppealByCase(caseId);
    if (existing && !["REJECTED", "ACCEPTED"].includes(existing.status)) {
      throw new ConflictError("An active appeal already exists for this case");
    }

    const appeal = await createAppeal({
      case_id: caseId,
      appeal_text: body.appeal_text,
      ...(body.citations ? { citations: body.citations } : {}),
    });

    // Move case to APPEAL_READY so insurer sees it needs review
    await updateCaseStatus(caseId, "APPEAL_READY");
    await updateAppealStatus(appeal.id, "PENDING_REVIEW");

    await createAuditLog({
      case_id: caseId,
      actor_id: user.id,
      actor_type: "human",
      action: "patient_appeal_submitted",
      previous_state: caseData.status,
      new_state: "APPEAL_READY",
      metadata: { appeal_id: appeal.id, submitted_by: user.email },
    });

    // Mirror status to Sheets
    sheetsService.updateCaseRow({ ...caseData, status: "APPEAL_READY" }).catch(() => {});

    // Calendar event
    createAppealDeadlineEvent({
      summary: `Appeal Submitted: ${caseData.case_number}`,
      description: `Patient appeal for case ${caseData.case_number} (${caseData.service_type}).`,
      startDate: new Date().toISOString().split("T")[0]!,
    }).catch(() => {});

    // Email patient: confirmation their appeal was received
    notifyPatient(
      user.id,
      caseId,
      "appeal_submitted",
      "Your Appeal Has Been Submitted",
      `Your appeal for case ${caseData.case_number} has been submitted for review.`,
      {
        caseNumber: caseData.case_number,
        serviceType: caseData.service_type,
      },
    ).catch(() => {});

    // Email insurers: a patient appeal needs their attention
    notifyInsurersByOrg(
      caseData.insurer_org_id,
      caseId,
      "appeal_received_by_insurer",
      "Patient Appeal Received",
      `Patient has submitted an appeal for case ${caseData.case_number}. Review required.`,
      {
        caseNumber: caseData.case_number,
        serviceType: caseData.service_type,
        appealText: body.appeal_text,
        patientName: user.full_name,
      },
    ).catch(() => {});

    sendCreated(res, appeal, "Appeal submitted successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Get All Appeals for a Case (Insurer View) ────────────────────────────────

export async function getAppealsForCase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const caseId = req.params.id as string;

    const caseData = await getCaseById(caseId);
    if (user.role === "insurance_provider" && caseData.insurer_org_id !== user.organization_id)
      throw new ForbiddenError();
    if (user.role === "patient" && caseData.patient_id !== user.id)
      throw new ForbiddenError();

    const { data } = await supabase
      .from("appeals")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    sendSuccess(res, data ?? []);
  } catch (err) {
    next(err);
  }
}
