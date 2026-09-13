import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { assertCaseScope } from "../middleware/rbac.js";
import { HttpError } from "../middleware/error-handler.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const caseId =
      typeof req.body?.case_id === "string" ? req.body.case_id : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const documentType =
      typeof req.body?.document_type === "string"
        ? req.body.document_type
        : "clinical_note";
    if (!caseId || !name)
      throw new HttpError(400, "case_id and name are required");

    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
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
      .from("documents")
      .insert({
        case_id: caseId,
        name,
        document_type: documentType,
        drive_file_id: `local_${crypto.randomUUID()}`,
        uploaded_by: user.id,
        is_missing: false,
      })
      .select("*")
      .single();
    if (error || !data)
      throw new HttpError(500, "Failed to save document", error?.message);

    if (existing.status === "ACTION_REQUIRED") {
      await supabase
        .from("cases")
        .update({ status: "ANALYZING" })
        .eq("id", caseId);
    }

    await supabase.from("audit_logs").insert({
      case_id: caseId,
      actor_id: user.id,
      actor_type: "human",
      action: "document_uploaded",
      metadata: { name, document_type: documentType },
    });

    res.status(201).json({ document: data });
  } catch (err) {
    next(err);
  }
});

export default router;
