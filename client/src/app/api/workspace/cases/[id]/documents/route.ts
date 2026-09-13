import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { uploadPatientPrescription } from "@/lib/google-drive";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inferDocumentType,
  notifyOrgProviders,
  notifyUser,
} from "@/lib/workspace-notify";

const DOCUMENT_TYPES = new Set([
  "denial_letter",
  "clinical_note",
  "mri_report",
  "lab_result",
  "prior_auth_form",
  "appeal_letter",
  "policy_document",
  "prescription",
  "other",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin
    .from("cases")
    .select("id, patient_id, insurer_org_id, case_number, status")
    .eq("id", id)
    .maybeSingle();

  if (claimError || !claim) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const allowed =
    profile.role === "patient"
      ? claim.patient_id === user.id
      : claim.insurer_org_id === profile.organization_id;
  if (!allowed) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let name = "";
  let documentType = "clinical_note";
  let driveFileId = "pending";
  let driveUrl: string | null = null;
  let replaceDocumentId = "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    name = typeof form.get("name") === "string" ? String(form.get("name")).trim() : "";
    const typeValue =
      typeof form.get("document_type") === "string"
        ? String(form.get("document_type"))
        : "clinical_note";
    if (DOCUMENT_TYPES.has(typeValue)) documentType = typeValue;
    replaceDocumentId =
      typeof form.get("replace_document_id") === "string"
        ? String(form.get("replace_document_id"))
        : "";
    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (!name) name = file.name;
      const patientName =
        profile.full_name?.trim() || user.email?.split("@")[0] || "patient";
      const uploaded = await uploadPatientPrescription({
        patientName,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        content: Buffer.from(await file.arrayBuffer()),
      });
      driveFileId = uploaded.drive_file_id;
      driveUrl = uploaded.drive_url;
    }
  } else {
    let body: {
      name?: unknown;
      document_type?: unknown;
      drive_file_id?: unknown;
      drive_url?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    name = typeof body.name === "string" ? body.name.trim() : "";
    if (
      typeof body.document_type === "string" &&
      DOCUMENT_TYPES.has(body.document_type)
    ) {
      documentType = body.document_type;
    }
    if (typeof body.drive_file_id === "string" && body.drive_file_id) {
      driveFileId = body.drive_file_id;
    }
    if (typeof body.drive_url === "string") driveUrl = body.drive_url;
    if (typeof (body as { replace_document_id?: unknown }).replace_document_id === "string") {
      replaceDocumentId = String(
        (body as { replace_document_id?: string }).replace_document_id,
      );
    }
  }

  if (!name) {
    return NextResponse.json({ error: "Document name is required" }, { status: 400 });
  }

  if (replaceDocumentId && driveFileId === "pending") {
    return NextResponse.json(
      { error: "Choose a file to upload for this missing record" },
      { status: 400 },
    );
  }

  let data: Record<string, unknown> | null = null;
  if (replaceDocumentId) {
    const { data: updated, error } = await admin
      .from("documents")
      .update({
        name: name || undefined,
        document_type: DOCUMENT_TYPES.has(documentType)
          ? documentType
          : inferDocumentType(name),
        drive_file_id: driveFileId,
        drive_url: driveUrl,
        uploaded_by: user.id,
        is_missing: false,
      })
      .eq("id", replaceDocumentId)
      .eq("case_id", claim.id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json(
        { error: "Could not replace that missing document" },
        { status: 500 },
      );
    }
    data = updated;
  } else {
    const inserted = await admin
      .from("documents")
      .insert({
        case_id: claim.id,
        name,
        document_type: documentType,
        drive_file_id: driveFileId,
        drive_url: driveUrl,
        uploaded_by: user.id,
        is_missing: false,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      return NextResponse.json(
        { error: "Could not save the document" },
        { status: 500 },
      );
    }
    data = inserted.data;
  }

  const { count: remainingMissing } = await admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("case_id", claim.id)
    .eq("is_missing", true);

  const stillWaiting = (remainingMissing ?? 0) > 0;
  const nextStatus = stillWaiting
    ? "ACTION_REQUIRED"
    : claim.status === "ACTION_REQUIRED"
      ? "ANALYZING"
      : claim.status;

  if (nextStatus !== claim.status) {
    await admin.from("cases").update({ status: nextStatus }).eq("id", claim.id);
  }

  await admin.from("audit_logs").insert({
    case_id: claim.id,
    actor_id: user.id,
    actor_type: "human",
    action: replaceDocumentId ? "missing_document_uploaded" : "document_uploaded",
    previous_state: claim.status,
    new_state: nextStatus,
    metadata: { document_id: data.id, name, document_type: documentType },
  });

  if (profile.role === "patient") {
    await notifyUser(admin, {
      userId: user.id,
      caseId: claim.id,
      type: "case_update",
      title: "Document received",
      message: `${name} was added to ${claim.case_number}. Healthcare has been notified.`,
    }).catch(() => {});
    await notifyOrgProviders(admin, claim.insurer_org_id, {
      caseId: claim.id,
      type: "case_update",
      title: "Patient responded",
      message: `The patient uploaded “${name}” for ${claim.case_number}. Review the updated packet.`,
    }).catch(() => {});
  }

  return NextResponse.json({ document: data, status: nextStatus }, { status: 201 });
}
