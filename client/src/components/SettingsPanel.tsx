"use client";

import { useRouter } from "next/navigation";
import { Building2, Mail, Shield, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { displayName, initials } from "@/lib/format";
import { roleLabel } from "@/lib/types";

export function SettingsPanel() {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const email = profile?.email ?? user?.email ?? "—";
  const name = displayName({
    fullName:
      profile?.full_name ??
      (typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null),
    email,
  });
  const role = profile ? roleLabel(profile.role) : "—";
  const organization = profile
    ? profile.role === "insurance_provider"
      ? (profile.organization_name ?? "Assigned insurer organization")
      : "Personal patient account"
    : "Profile still loading";

  const rows = [
    { icon: UserRound, label: "Name", value: name },
    { icon: Mail, label: "Email", value: email },
    { icon: Shield, label: "Role", value: role },
    { icon: Building2, label: "Organization", value: organization },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="cs-panel rounded-2xl p-5">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/12 text-lg font-semibold text-accent">
          {initials(name)}
        </div>
        <p className="mt-4 font-semibold">{name}</p>
        <p className="mt-1 text-sm text-muted">{email}</p>
        <p className="mt-3 inline-flex rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">
          {role}
        </p>
      </div>

      <div className="cs-panel rounded-2xl p-5">
        <p className="text-sm font-semibold">Account</p>
        <p className="mt-1 text-sm text-muted">
          Workspace access is scoped by role. Patients never see healthcare
          tools.
        </p>
        <dl className="mt-5 divide-y divide-border">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Icon size={16} className="mt-0.5 text-muted" />
                <div>
                  <dt className="text-xs text-muted">{row.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium">{row.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs text-muted">Appearance</p>
          <p className="mt-1 mb-3 text-sm text-muted">
            Switch the workspace between light and dark. Your choice is saved on
            this device.
          </p>
          <ThemeToggle />
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
          className="cs-btn cs-btn-ghost mt-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
