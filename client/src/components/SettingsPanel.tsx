"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/types";

export function SettingsPanel() {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();

  return (
    <div className="cs-panel max-w-2xl rounded-3xl p-6">
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-muted">Name</dt>
          <dd className="mt-1 font-medium">{profile?.full_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="mt-1 font-medium">
            {profile?.email ?? user?.email ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Role</dt>
          <dd className="mt-1 font-medium">
            {profile ? roleLabel(profile.role) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Organization</dt>
          <dd className="mt-1 font-medium">
            {profile?.organization_id
              ? "Assigned insurer org"
              : "None · patient account"}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/login");
          router.refresh();
        }}
        className="cs-btn cs-btn-ghost mt-6"
      >
        Sign out
      </button>
    </div>
  );
}
