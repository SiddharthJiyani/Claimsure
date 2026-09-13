import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCaseScope, requireRole } from "../middleware/rbac.js";
import { HttpError } from "../middleware/error-handler.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
const CASE_SELECT = `
  *,
  denials (*),
  documents (*),
  appeals (*),
  agent_state (*),
  audit_logs (*)
`;

function scopeFilter(user: AuthedRequest["user"]) {
  if (user.profile.role === "patient") {
    return { column: "patient_id" as const, value: user.id };
  }
  if (!user.profile.organization_id) {
    throw new HttpError(403, "Healthcare account is missing an organization");
  }
  return {
    column: "insurer_org_id" as const,
    value: user.profile.organization_id,
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const scope = scopeFilter(user);
    const { data, error } = await getServiceClient()
      .from("cases")
      .select("*, denials(id), documents(id, is_missing)")
      .eq(scope.column, scope.value)
      .order("updated_at", { ascending: false });

    if (error) throw new HttpError(500, "Failed to load cases", error.message);
    res.json({ cases: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const { data, error } = await getServiceClient()
      .from("cases")
      .select(CASE_SELECT)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) throw new HttpError(500, "Failed to load case", error.message);
    if (!data) throw new HttpError(404, "Case not found");
    assertCaseScope(
      user.profile.role,
      user.id,
      user.profile.organization_id,
      data.patient_id,
      data.insurer_org_id,
    );
    res.json({ case: data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireAuth,
  requireRole("patient"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthedRequest;
      const serviceType =
        typeof req.body?.service_type === "string"
          ? req.body.service_type.trim()
          : "";
      if (!serviceType) throw new HttpError(400, "service_type is required");

      const supabase = getServiceClient();
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!org)
        throw new HttpError(400, "No insurer organization is configured yet");

      const { data, error } = await supabase
        .from("cases")
        .insert({
          patient_id: user.id,
          insurer_org_id: org.id,
          service_type: serviceType,
          service_code:
            typeof req.body?.service_code === "string"
              ? req.body.service_code
              : null,
          payer_id:
            typeof req.body?.payer_id === "string"
              ? req.body.payer_id
              : "payer_a",
          status: "PENDING",
        })
        .select("*")
        .single();

      if (error || !data)
        throw new HttpError(500, "Failed to create case", error?.message);

      await supabase.from("audit_logs").insert({
        case_id: data.id,
        actor_id: user.id,
        actor_type: "human",
        action: "case_created",
        new_state: "PENDING",
      });
      await supabase.from("notifications").insert({
        user_id: user.id,
        case_id: data.id,
        type: "case_update",
        title: "Claim submitted",
        message: `${data.case_number} is now pending review.`,
        channel: "in_app",
        sent_at: new Date().toISOString(),
      });

      res.status(201).json({ case: data });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:id/analyze",
  requireAuth,
  requireRole("insurance_provider"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthedRequest;
      const supabase = getServiceClient();
      const { data: existing, error: loadError } = await supabase
        .from("cases")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();

      if (loadError)
        throw new HttpError(500, "Failed to load case", loadError.message);
      if (!existing) throw new HttpError(404, "Case not found");
      assertCaseScope(
        user.profile.role,
        user.id,
        user.profile.organization_id,
        existing.patient_id,
        existing.insurer_org_id,
      );

      const previous = existing.status;
      const { data, error } = await supabase
        .from("cases")
        .update({ status: "ANALYZING" })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error || !data)
        throw new HttpError(500, "Failed to start analysis", error?.message);

      await supabase.from("agent_state").insert({
        case_id: existing.id,
        current_node: "parse_denial",
        state_data: { dry_run: true, triggered_by: user.id },
        is_dry_run: true,
      });
      await supabase.from("audit_logs").insert({
        case_id: existing.id,
        actor_id: user.id,
        actor_type: "human",
        action: "trigger_agent",
        node: "parse_denial",
        previous_state: previous,
        new_state: "ANALYZING",
      });

      const aiUrl = process.env.AI_SERVER_URL;
      if (aiUrl) {
        fetch(`${aiUrl}/workflows/denial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ case_id: existing.id, dry_run: true }),
        }).catch((err) => {
          console.warn("AI server unavailable, analysis remains queued:", err);
        });
      }

      res.json({ case: data, queued: true });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("insurance_provider"),
  async (req, res, next) => {
    try {
      const { user } = req as AuthedRequest;
      const status =
        typeof req.body?.status === "string" ? req.body.status : "";
      const allowed = [
        "PENDING",
        "ANALYZING",
        "ACTION_REQUIRED",
        "AWAITING_REVIEW",
        "APPEAL_READY",
        "SUBMITTED",
        "VERIFYING",
        "RESOLVED",
        "ESCALATED",
        "CLOSED",
      ];
      if (!allowed.includes(status)) throw new HttpError(400, "Invalid status");

      const supabase = getServiceClient();
      const { data: existing } = await supabase
        .from("cases")
        .select("*")
        .eq("id", req.params.id)
        .maybeSingle();
      if (!existing) throw new HttpError(404, "Case not found");
      assertCaseScope(
        user.profile.role,
        user.id,
        user.profile.organization_id,
        existing.patient_id,
        existing.insurer_org_id,
      );

      const { data, error } = await supabase
        .from("cases")
        .update({ status })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error || !data)
        throw new HttpError(500, "Failed to update status", error?.message);

      await supabase.from("audit_logs").insert({
        case_id: existing.id,
        actor_id: user.id,
        actor_type: "human",
        action: "status_update",
        previous_state: existing.status,
        new_state: status,
        human_decision:
          typeof req.body?.decision === "string" ? req.body.decision : null,
      });

      res.json({ case: data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
