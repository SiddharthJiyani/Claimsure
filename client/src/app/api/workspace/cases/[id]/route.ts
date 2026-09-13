import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import {
  agentMissingLabels,
  hasMatchingDocument,
  normalizeEvidenceLabel,
  uniqueDocumentsByName,
} from "@/lib/missing-evidence";
import { createAdminClient } from "@/lib/supabase/admin";
import { inferDocumentType, notifyOrgProviders, notifyUser } from "@/lib/workspace-notify";
import type { AgentState, DocumentRecord } from "@/lib/types";

const CASE_SELECT = `
  *,
  denials (*),
  documents (*),
  appeals (*),
  agent_state (*),
  audit_logs (*)
`;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .select(CASE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not load case" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const allowed =
    profile.role === "patient"
      ? data.patient_id === user.id
      : data.insurer_org_id === profile.organization_id;
  if (!allowed) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const claim = await persistAgentMissingDocuments(admin, data);
  return NextResponse.json({
    case: {
      ...claim,
      documents: uniqueDocumentsByName(claim.documents ?? []),
    },
  });
}

async function persistAgentMissingDocuments(
  admin: ReturnType<typeof createAdminClient>,
  claim: {
    id: string;
    patient_id: string;
    case_number: string;
    status: string;
    documents?: DocumentRecord[] | null;
    agent_state?: AgentState[] | null;
  },
) {
  const labels = agentMissingLabels(claim.agent_state ?? undefined);
  const existing = [...(claim.documents ?? [])];

  const duplicateIds: string[] = [];
  const seenMissing = new Set<string>();
  for (const doc of existing) {
    if (!doc.is_missing) continue;
    const key = normalizeEvidenceLabel(doc.name);
    if (seenMissing.has(key)) {
      duplicateIds.push(doc.id);
    } else {
      seenMissing.add(key);
    }
  }
  if (duplicateIds.length) {
    await admin.from("documents").delete().in("id", duplicateIds);
    claim = {
      ...claim,
      documents: existing.filter((doc) => !duplicateIds.includes(doc.id)),
    };
  }

  const currentDocs = (claim.documents ?? []).filter(
    (doc) => !duplicateIds.includes(doc.id),
  );
  if (!labels.length) {
    return { ...claim, documents: currentDocs };
  }

  const created: string[] = [];
  for (const name of labels) {
    if (hasMatchingDocument(currentDocs, name)) continue;
    const { data, error } = await admin
      .from("documents")
      .insert({
        case_id: claim.id,
        name,
        document_type: inferDocumentType(name),
        drive_file_id: "pending",
        is_missing: true,
      })
      .select("*")
      .single();
    if (!error && data) {
      currentDocs.push(data as DocumentRecord);
      created.push(name);
    }
  }

  if (!created.length) {
    return { ...claim, documents: currentDocs };
  }

  const openStatuses = new Set([
    "PENDING",
    "ANALYZING",
    "AWAITING_REVIEW",
    "APPEAL_READY",
  ]);
  if (openStatuses.has(claim.status)) {
    await admin
      .from("cases")
      .update({ status: "ACTION_REQUIRED" })
      .eq("id", claim.id);
    claim = { ...claim, status: "ACTION_REQUIRED", documents: currentDocs };
  }

  await notifyUser(admin, {
    userId: claim.patient_id,
    caseId: claim.id,
    type: "action_required",
    title: "Action required: upload missing records",
    message: `${claim.case_number} needs: ${created.join("; ")}.`,
  }).catch(() => {});

  const { data: refreshed } = await admin
    .from("cases")
    .select(CASE_SELECT)
    .eq("id", claim.id)
    .maybeSingle();
  return refreshed ?? { ...claim, documents: currentDocs };
}

const LOCKED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "patient") {
    return NextResponse.json(
      { error: "Only patients can remove their own claims" },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: claim, error } = await admin
    .from("cases")
    .select("id, patient_id, status, case_number, insurer_org_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !claim || claim.patient_id !== user.id) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (LOCKED_STATUSES.has(claim.status)) {
    return NextResponse.json(
      { error: "This claim is already closed and cannot be removed" },
      { status: 409 },
    );
  }

  const { error: updateError } = await admin
    .from("cases")
    .update({ status: "CLOSED" })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json(
      { error: "Could not remove this claim" },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    case_id: id,
    actor_id: user.id,
    actor_type: "human",
    action: "claim_withdrawn",
    previous_state: claim.status,
    new_state: "CLOSED",
  });
  await admin.from("notifications").insert({
    user_id: user.id,
    case_id: id,
    type: "case_update",
    title: "Claim removed",
    message: `${claim.case_number} was withdrawn and is no longer in review.`,
    channel: "in_app",
    sent_at: new Date().toISOString(),
  });
  await notifyOrgProviders(admin, claim.insurer_org_id, {
    caseId: id,
    type: "case_update",
    title: "Patient withdrew claim",
    message: `${claim.case_number} was withdrawn by the patient.`,
  });

  return NextResponse.json({ ok: true, status: "CLOSED" });
}
