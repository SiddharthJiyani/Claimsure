/**
 * decisions.controller.ts
 *
 * Insurance providers make the FINAL DECISION on a claim: ACCEPTED or REJECTED.
 * This is separate from appeals. The flow is:
 *   1. Agent runs → analysis report generated
 *   2. Insurance provider reviews report → calls POST /cases/:id/decision
 *   3. If REJECTED → patient is notified and can submit an appeal
 *   4. If ACCEPTED → case moves to RESOLVED
 */

import type { Request, Response, NextFunction } from "express";
import { getCaseById, getCaseWithDetails, updateCaseStatus } from "../database/queries/cases.js";
import { getAppealByCase, updateAppealStatus } from "../database/queries/appeals.js";
import { createAuditLog } from "../database/queries/audit.js";
import { supabase } from "../database/supabase.js";
import { sendSuccess } from "../lib/response.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";
import { notifyPatient, notifyInsurersByOrg } from "../services/notifications.js";
import * as sheetsService from "../services/google-sheets.js";
import { z } from "zod";

export const claimDecisionSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  reason: z.string().min(10).optional(),
});

export type ClaimDecisionInput = z.infer<typeof claimDecisionSchema>;

async function automaticDecisionReason(caseId: string, fallback: string) {
  const { data } = await supabase
    .from("agent_state")
    .select("state_data")
    .eq("case_id", caseId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const state = (data?.state_data ?? {}) as Record<string, unknown>;
  const safetyReason = typeof state.safety_reason === "string" ? state.safety_reason : "";
  const missing = Array.isArray(state.evidence_missing)
    ? state.evidence_missing.filter((item): item is string => typeof item === "string")
    : [];
  const policy = Array.isArray(state.citations)
    ? state.citations.filter((item): item is string => typeof item === "string")
    : [];
  return [
    safetyReason,
    missing.length ? `Evidence shortcomings: ${missing.join("; ")}.` : "",
    policy.length ? `Policy references reviewed: ${policy.join(", ")}.` : "",
    fallback,
  ].filter(Boolean).join(" ").slice(0, 2000);
}

/**
 * POST /api/cases/:id/decision
 * Insurance provider accepts or rejects a claim with a documented reason.
 */
export async function makeClaimDecision(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const body = req.body as ClaimDecisionInput;

    if (user.role !== "insurance_provider") {
      throw new ForbiddenError("Only insurance providers can make claim decisions");
    }

    const existing = await getCaseById(id);
    if (existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError("You do not have access to this case");
    }

    const reason = body.reason ?? await automaticDecisionReason(
      id,
      body.decision === "REJECTED"
        ? "The claim was not approved because the submitted evidence did not establish coverage under the reviewed policy."
        : "The claim satisfied the reviewed policy requirements and evidence criteria.",
    );

    // Map decision to case status
    const newStatus = body.decision === "ACCEPTED" ? "RESOLVED" : "AWAITING_REVIEW";

    // Persist the decision in a case metadata column (use agent_state for now)
    await supabase.from("agent_state").insert({
      case_id: id,
      current_node: "decision",
      state_data: {
        decision: body.decision,
        decision_reason: reason,
        decided_by: user.email,
        decided_at: new Date().toISOString(),
      },
      is_dry_run: false,
    });

    const updated = await updateCaseStatus(id, newStatus);

    await createAuditLog({
      case_id: id,
      actor_id: user.id,
      actor_type: "human",
      action: body.decision === "ACCEPTED" ? "claim_accepted" : "claim_rejected",
      previous_state: existing.status,
      new_state: newStatus,
      human_decision: body.decision,
      metadata: {
        decision_reason: reason,
        decided_by: user.email,
      },
    });

    // Mirror to Sheets
    sheetsService.updateCaseRow({ ...updated, status: newStatus }).catch(() => {});

    // Notify patient of the decision (with appeal rights if rejected)
    notifyPatient(
      existing.patient_id,
      id,
      "claim_decision",
      body.decision === "ACCEPTED" ? "Your Claim Was Accepted" : "Your Claim Was Rejected",
      reason,
      {
        caseNumber: existing.case_number,
        serviceType: existing.service_type,
        decision: body.decision,
        decisionReason: reason,
      },
    ).catch(() => {});

    sendSuccess(
      res,
      {
        case_id: id,
        decision: body.decision,
        new_status: newStatus,
        reason,
      },
      `Claim ${body.decision.toLowerCase()} successfully`,
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:id/decision
 * Retrieve the latest insurer decision for a case.
 */
export async function getClaimDecision(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const existing = await getCaseById(id);
    if (user.role === "patient" && existing.patient_id !== user.id) {
      throw new ForbiddenError();
    }
    if (user.role === "insurance_provider" && existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError();
    }

    const { data } = await supabase
      .from("agent_state")
      .select("*")
      .eq("case_id", id)
      .eq("current_node", "decision")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    sendSuccess(res, data?.state_data ?? null);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/cases/:id/appeal-decision
 * Insurance provider makes FINAL decision on a PATIENT appeal.
 * Separate from the initial claim decision.
 */
export async function makeAppealDecision(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const body = req.body as ClaimDecisionInput;

    if (user.role !== "insurance_provider") {
      throw new ForbiddenError("Only insurance providers can decide on appeals");
    }

    const existing = await getCaseById(id);
    if (existing.insurer_org_id !== user.organization_id) {
      throw new ForbiddenError("You do not have access to this case");
    }

    const reason = body.reason ?? await automaticDecisionReason(
      id,
      body.decision === "REJECTED"
        ? "The appeal was rejected because the submitted evidence did not establish coverage under the reviewed policy."
        : "The appeal satisfied the reviewed policy requirements and evidence criteria.",
    );

    const newStatus = body.decision === "ACCEPTED" ? "RESOLVED" : "CLOSED";

    await supabase.from("agent_state").insert({
      case_id: id,
      current_node: "appeal_decision",
      state_data: {
        decision: body.decision,
        decision_reason: reason,
        decided_by: user.email,
        decided_at: new Date().toISOString(),
      },
      is_dry_run: false,
    });

    const updated = await updateCaseStatus(id, newStatus);
    const appeal = await getAppealByCase(id).catch(() => null);
    if (appeal) {
      await updateAppealStatus(
        appeal.id,
        body.decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED",
      ).catch(() => {});
    }

    await createAuditLog({
      case_id: id,
      actor_id: user.id,
      actor_type: "human",
      action: body.decision === "ACCEPTED" ? "appeal_accepted" : "appeal_rejected",
      previous_state: existing.status,
      new_state: newStatus,
      human_decision: body.decision,
      metadata: { decision_reason: reason, decided_by: user.email },
    });

    sheetsService.updateCaseRow({ ...updated, status: newStatus }).catch(() => {});

    // Notify patient of appeal outcome
    notifyPatient(
      existing.patient_id,
      id,
      "appeal_decision",
      body.decision === "ACCEPTED" ? "Your Appeal Was Accepted" : "Your Appeal Was Rejected",
      reason,
      {
        caseNumber: existing.case_number,
        serviceType: existing.service_type,
        decision: body.decision,
        decisionReason: reason,
      },
    ).catch(() => {});

    sendSuccess(
      res,
      { case_id: id, decision: body.decision, new_status: newStatus, reason },
      `Appeal ${body.decision.toLowerCase()} successfully`,
    );
  } catch (err) {
    next(err);
  }
}
