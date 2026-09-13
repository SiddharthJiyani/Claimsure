import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
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
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Could not update notification" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
