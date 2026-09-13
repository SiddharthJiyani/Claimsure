import { Router } from "express";
import { getServiceClient } from "../database/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error-handler.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

router.post("/seed", requireAuth, async (req, res, next) => {
  try {
    const { user } = req as AuthedRequest;
    const supabase = getServiceClient();

    let patientId = user.profile.role === "patient" ? user.id : null;
    let orgId = user.profile.organization_id;

    if (!patientId) {
      const { data: patient } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "patient")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      patientId = patient?.id ?? null;
    }

    if (!orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      orgId = org?.id ?? null;
    }

    if (!orgId) {
      const { data: created, error } = await supabase
        .from("organizations")
        .insert({ name: "Aetna Health", type: "insurance_provider" })
        .select("id")
        .single();
      if (error || !created)
        throw new HttpError(500, "Failed to create demo org", error?.message);
      orgId = created.id;
    }

    if (!patientId) {
      throw new HttpError(
        400,
        "Seed a patient account first, then load demo cases from the healthcare dashboard.",
      );
    }

    const { data: existing } = await supabase
      .from("cases")
      .select("id")
      .eq("patient_id", patientId)
      .limit(1);
    if (existing && existing.length > 0) {
      res.json({
        seeded: false,
        message: "Demo cases already exist for this patient.",
      });
      return;
    }

    const demoCases = [
      {
        case_number: "R1007",
        service_type: "MRI Lumbar Spine",
        service_code: "CPT-72148",
        payer_id: "payer_a",
        status: "ACTION_REQUIRED",
      },
      {
        case_number: "R1008",
        service_type: "CT Chest",
        service_code: "CPT-71260",
        payer_id: "payer_a",
        status: "ANALYZING",
      },
      {
        case_number: "R1009",
        service_type: "Physical Therapy",
        service_code: "CPT-97110",
        payer_id: "payer_b",
        status: "RESOLVED",
      },
      {
        case_number: "R1010",
        service_type: "Sleep Study",
        service_code: "CPT-95810",
        payer_id: "payer_a",
        status: "AWAITING_REVIEW",
      },
      {
        case_number: "R1011",
        service_type: "Knee MRI",
        service_code: "CPT-73721",
        payer_id: "payer_b",
        status: "PENDING",
      },
    ];

    const { data: inserted, error } = await supabase
      .from("cases")
      .insert(
        demoCases.map((row) => ({
          ...row,
          patient_id: patientId,
          insurer_org_id: orgId,
        })),
      )
      .select("*");

    if (error || !inserted)
      throw new HttpError(500, "Failed to seed cases", error?.message);

    const byNumber = Object.fromEntries(
      inserted.map((row) => [row.case_number as string, row]),
    );
    const r1007 = byNumber.R1007;
    const r1008 = byNumber.R1008;
    if (!r1007 || !r1008)
      throw new HttpError(
        500,
        "Demo cases were inserted without expected case numbers",
      );

    await supabase.from("denials").insert([
      {
        case_id: r1007.id,
        denial_code: "MEDNEC-04",
        denial_reason:
          "Medical necessity not established — missing recent clinical notes documenting conservative therapy.",
        denial_date: new Date(Date.now() - 12 * 86400000)
          .toISOString()
          .slice(0, 10),
        appeal_deadline: new Date(Date.now() + 18 * 86400000)
          .toISOString()
          .slice(0, 10),
        raw_text:
          "Denial: MRI lumbar spine denied. Conservative therapy documentation required per policy A §4.2.",
      },
      {
        case_id: r1008.id,
        denial_code: "AUTH-12",
        denial_reason: "Prior authorization not on file for contrast CT.",
        denial_date: new Date(Date.now() - 4 * 86400000)
          .toISOString()
          .slice(0, 10),
        appeal_deadline: new Date(Date.now() + 26 * 86400000)
          .toISOString()
          .slice(0, 10),
        raw_text: "CT chest with contrast requires prospective authorization.",
      },
    ]);

    await supabase.from("documents").insert([
      {
        case_id: r1007.id,
        name: "Denial letter — MRI lumbar",
        document_type: "denial_letter",
        drive_file_id: "drive_r1007_denial",
        is_missing: false,
        uploaded_by: patientId,
      },
      {
        case_id: r1007.id,
        name: "Clinical note (last 6 months)",
        document_type: "clinical_note",
        drive_file_id: "pending",
        is_missing: true,
      },
      {
        case_id: r1007.id,
        name: "MRI order / referral",
        document_type: "order",
        drive_file_id: "drive_r1007_order",
        is_missing: false,
        uploaded_by: patientId,
      },
    ]);

    await supabase.from("appeals").insert({
      case_id: r1007.id,
      status: "DRAFT",
      appeal_text:
        "Appeal draft pending missing clinical note. Policy A §4.2 requires documented conservative therapy for ≥6 weeks.",
      citations: [
        {
          policy_id: "payer_a",
          clause: "4.2",
          text: "Conservative therapy documentation required before advanced imaging.",
        },
      ],
    });

    await supabase.from("notifications").insert({
      user_id: user.id,
      case_id: r1007.id,
      type: "action_required",
      title: "Demo cases ready",
      message:
        "Five sample claims were added, including R1007 which needs a clinical note.",
      channel: "in_app",
      sent_at: new Date().toISOString(),
    });

    res.status(201).json({ seeded: true, cases: inserted });
  } catch (err) {
    next(err);
  }
});

export default router;
