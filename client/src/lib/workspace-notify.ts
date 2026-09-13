import type { createAdminClient } from "@/lib/supabase/admin";
import { postSlackChannelUpdate } from "@/lib/slack-channel";

type Admin = ReturnType<typeof createAdminClient>;

export async function notifyUser(
  admin: Admin,
  input: {
    userId: string;
    caseId?: string;
    type: string;
    title: string;
    message: string;
  },
) {
  await admin.from("notifications").insert({
    user_id: input.userId,
    case_id: input.caseId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    channel: "in_app",
    sent_at: new Date().toISOString(),
  });
}

export async function notifyOrgProviders(
  admin: Admin,
  orgId: string,
  input: {
    caseId: string;
    type: string;
    title: string;
    message: string;
  },
) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("role", "insurance_provider");
  await Promise.all(
    (data ?? []).map((profile) =>
      notifyUser(admin, {
        userId: profile.id,
        caseId: input.caseId,
        type: input.type,
        title: input.title,
        message: input.message,
      }),
    ),
  );
  await postSlackChannelUpdate({
    title: input.title,
    message: input.message,
    event: input.type,
  }).catch(() => {});
}

export { inferDocumentType } from "@/lib/missing-evidence";
