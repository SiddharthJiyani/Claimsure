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
