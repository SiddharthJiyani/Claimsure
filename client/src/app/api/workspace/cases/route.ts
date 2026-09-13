import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CASE_LIST_SELECT =
  "*, denials(id, denial_reason), documents(id, name, document_type, is_missing, created_at)";

export async function GET() {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("cases")
    .select(CASE_LIST_SELECT)
    .order("updated_at", { ascending: false });

  if (profile.role === "patient") {
    query = query.eq("patient_id", user.id);
  } else if (profile.organization_id) {
    query = query.eq("insurer_org_id", profile.organization_id);
  } else {
    return NextResponse.json(
      { error: "Healthcare account is missing an organization" },
      { status: 403 },
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Could not load cases" },
      { status: 500 },
    );
  }
  return NextResponse.json({ cases: data ?? [] });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "patient") {
    return NextResponse.json(
      { error: "Only patients can submit a claim from this workspace" },
      { status: 403 },
    );
  }

  let body: {
    service_type?: unknown;
    service_code?: unknown;
    insurer_org_id?: unknown;
    disease?: unknown;
    claim_purpose?: unknown;
    drive_file_id?: unknown;
    drive_url?: unknown;
    document_name?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const serviceType =
    typeof body.service_type === "string" ? body.service_type.trim() : "";
  if (!serviceType) {
    return NextResponse.json(
      { error: "Service type is required" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    let insurerOrgId =
      typeof body.insurer_org_id === "string" ? body.insurer_org_id.trim() : "";
    if (!UUID_RE.test(insurerOrgId)) {
      const { data: org } = await admin
        .from("organizations")
        .select("id")
        .eq("type", "insurance_provider")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      insurerOrgId = org?.id ?? "";
    }
    if (!UUID_RE.test(insurerOrgId)) {
      return NextResponse.json(
        { error: "No health provider is available yet" },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("cases")
      .insert({
        patient_id: user.id,
        insurer_org_id: insurerOrgId,
        service_type: serviceType,
        service_code:
          typeof body.service_code === "string" ? body.service_code : null,
        payer_id:
          typeof body.disease === "string" && body.disease
            ? body.disease
            : null,
        status: "PENDING",
      })
      .select(CASE_LIST_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not create claim" },
        { status: 500 },
      );
    }

    const purpose =
      typeof body.claim_purpose === "string" ? body.claim_purpose.trim() : "";
    const disease = typeof body.disease === "string" ? body.disease.trim() : "";
    if (purpose || disease) {
      await admin.from("denials").insert({
        case_id: data.id,
        denial_reason:
          purpose ||
          `Prescription intake: ${disease || serviceType}`,
      });
    }

    const driveFileId =
      typeof body.drive_file_id === "string" ? body.drive_file_id : "";
    if (driveFileId) {
      await admin.from("documents").insert({
        case_id: data.id,
        name:
          typeof body.document_name === "string"
            ? body.document_name
            : "Doctor prescription",
        document_type: "prescription",
        drive_file_id: driveFileId,
        drive_url: typeof body.drive_url === "string" ? body.drive_url : null,
        uploaded_by: user.id,
        is_missing: false,
      });
    }

    await admin.from("audit_logs").insert({
      case_id: data.id,
      actor_id: user.id,
      actor_type: "human",
      action: "case_created",
      new_state: "PENDING",
    });
    await admin.from("notifications").insert({
      user_id: user.id,
      case_id: data.id,
      type: "case_update",
      title: "Claim submitted",
      message: `${data.case_number} is pending review.`,
      channel: "in_app",
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ case: data }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create claim";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
