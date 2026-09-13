import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getSessionUser();
  const profile = await getProfile();
  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Could not load notifications" },
      { status: 500 },
    );
  }
  return NextResponse.json({ notifications: data ?? [] });
}
