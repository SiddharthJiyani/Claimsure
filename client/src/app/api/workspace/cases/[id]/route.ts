import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

  return NextResponse.json({ case: data });
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
    .select("id, patient_id, status, case_number")
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

  return NextResponse.json({ ok: true, status: "CLOSED" });
}
