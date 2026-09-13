import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCaseScope, requireRole } from "../middleware/rbac.js";
import { HttpError } from "../middleware/error-handler.js";
import { routeParam } from "../http.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

async function loadAppealCase(appealId: string) {
  const supabase = getServiceClient();
  const { data: appeal, error } = await supabase
    .from("appeals")
    .select("*")
    .eq("id", appealId)
    .maybeSingle();
  if (error) throw new HttpError(500, "Failed to load appeal", error.message);
  if (!appeal) throw new HttpError(404, "Appeal not found");
  const { data: caseRow } = await supabase
    .from("cases")
    .select("*")
    .eq("id", appeal.case_id)
    .maybeSingle();
  if (!caseRow) throw new HttpError(404, "Case not found");
  return { appeal, caseRow, supabase };
}

router.post(
  "/:id/approve",
  requireAuth,
  requireRole("insurance_provider"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthedRequest;
      const { appeal, caseRow, supabase } = await loadAppealCase(
        routeParam(req.params.id, "id"),
      );
      assertCaseScope(
        user.profile.role,
        user.id,
        user.profile.organization_id,
        caseRow.patient_id,
        caseRow.insurer_org_id,
      );

      const { data, error } = await supabase
        .from("appeals")
        .update({
          status: "APPROVED",
          approved_by: user.id,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", appeal.id)
        .select("*")
        .single();
      if (error || !data)
        throw new HttpError(500, "Failed to approve appeal", error?.message);

      await supabase
        .from("cases")
        .update({ status: "SUBMITTED" })
        .eq("id", caseRow.id);
      await supabase.from("audit_logs").insert({
        case_id: caseRow.id,
        actor_id: user.id,
        actor_type: "human",
        action: "approve_appeal",
        node: "await_human",
        previous_state: caseRow.status,
        new_state: "SUBMITTED",
        human_decision: "approved",
      });
      await supabase.from("notifications").insert({
        user_id: caseRow.patient_id,
        case_id: caseRow.id,
        type: "case_update",
        title: "Appeal approved",
        message: `Your appeal for ${caseRow.case_number} was approved and submitted.`,
        channel: "in_app",
        sent_at: new Date().toISOString(),
      });

      res.json({ appeal: data });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/reject",
  requireAuth,
  requireRole("insurance_provider"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthedRequest;
      const { appeal, caseRow, supabase } = await loadAppealCase(
        routeParam(req.params.id, "id"),
      );
      assertCaseScope(
        user.profile.role,
        user.id,
        user.profile.organization_id,
        caseRow.patient_id,
        caseRow.insurer_org_id,
      );

      const { data, error } = await supabase
        .from("appeals")
        .update({ status: "REJECTED", approved_by: user.id })
        .eq("id", appeal.id)
        .select("*")
        .single();
      if (error || !data)
        throw new HttpError(500, "Failed to reject appeal", error?.message);

      await supabase
        .from("cases")
        .update({ status: "ESCALATED" })
        .eq("id", caseRow.id);
      await supabase.from("audit_logs").insert({
        case_id: caseRow.id,
        actor_id: user.id,
        actor_type: "human",
        action: "reject_appeal",
        node: "await_human",
        previous_state: caseRow.status,
        new_state: "ESCALATED",
        human_decision:
          typeof req.body?.reason === "string" ? req.body.reason : "rejected",
      });

      res.json({ appeal: data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
