import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { inferDocumentType, notifyUser } from "@/lib/workspace-notify";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "insurance_provider") {
    return NextResponse.json(
      { error: "Only healthcare reviewers can request records" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  let labels: string[] = [];
  try {
    const body = (await request.json()) as { labels?: unknown };
    labels = Array.isArray(body.labels)
      ? body.labels
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!labels.length) {
    return NextResponse.json(
      { error: "Add at least one document the patient should upload" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin
    .from("cases")
    .select("id, patient_id, insurer_org_id, case_number, status")
    .eq("id", id)
    .maybeSingle();

  if (claimError || !claim || claim.insurer_org_id !== profile.organization_id) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("documents")
    .select("id, name, is_missing")
    .eq("case_id", claim.id);

  const created: string[] = [];
  for (const name of labels) {
    const already = (existing ?? []).some(
      (doc) =>
        doc.is_missing && doc.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (already) continue;
    const { error } = await admin.from("documents").insert({
      case_id: claim.id,
      name,
      document_type: inferDocumentType(name),
      drive_file_id: "pending",
      is_missing: true,
    });
    if (!error) created.push(name);
  }

  await admin.from("cases").update({ status: "ACTION_REQUIRED" }).eq("id", claim.id);
  await admin.from("audit_logs").insert({
    case_id: claim.id,
    actor_id: user.id,
    actor_type: "human",
    action: "documents_requested",
    previous_state: claim.status,
    new_state: "ACTION_REQUIRED",
    metadata: { labels: created.length ? created : labels },
  });

  await notifyUser(admin, {
    userId: claim.patient_id,
    caseId: claim.id,
    type: "action_required",
    title: "Action required: upload missing records",
    message: `${claim.case_number} needs: ${(created.length ? created : labels).join("; ")}.`,
  });

  return NextResponse.json({
    requested: created.length ? created : labels,
    status: "ACTION_REQUIRED",
  });
}
