import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, type, created_at")
      .eq("type", "insurance_provider")
      .order("name");
    if (error) {
      return NextResponse.json(
        { error: "Could not load health providers" },
        { status: 500 },
      );
    }
    return NextResponse.json({ organizations: data ?? [] });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load health providers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
