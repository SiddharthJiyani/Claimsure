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
