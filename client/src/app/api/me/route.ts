import { NextResponse } from "next/server";
import { getProfile, getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await getProfile();
  return NextResponse.json({
    profile,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  });
}
