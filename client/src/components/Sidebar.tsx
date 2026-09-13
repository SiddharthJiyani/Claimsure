"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  FileSearch,
  Home,
  LogOut,
  ShieldPlus,
  Stethoscope,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth-context";
import { roleLabel, type UserRole } from "@/lib/types";

const PATIENT_LINKS = [{ href: "/patient", label: "My claims", icon: Home }];
const INSURER_LINKS = [
  { href: "/insurance", label: "Operations", icon: Activity },
  { href: "/insurance/eval", label: "Eval harness", icon: FileSearch },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const links = role === "patient" ? PATIENT_LINKS : INSURER_LINKS;
  const Icon = role === "patient" ? Stethoscope : ShieldPlus;

  return (
    <aside className="flex w-full flex-col border-b border-border bg-surface lg:h-full lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-4">
        <Link
          href={role === "patient" ? "/patient" : "/insurance"}
          className="flex items-center gap-2"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
            <Icon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">Claimsure</p>
            <p className="text-xs text-muted">{roleLabel(role)} portal</p>
          </div>
        </Link>
        <div className="lg:hidden">
          <NotificationBell />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
        {links.map((link) => {
          const active = pathname === link.href;
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <LinkIcon size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="hidden items-center justify-between border-t border-border px-4 py-4 lg:flex">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{profile?.full_name}</p>
          <p className="truncate text-xs text-muted">{profile?.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
          className="rounded-xl border border-border p-2 text-muted hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-full flex-col bg-background lg:flex-row">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-3 border-b border-border px-6 py-3 lg:flex">
          <NotificationBell />
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login");
              router.refresh();
            }}
            className="text-sm text-muted hover:text-foreground"
          >
            Sign out {profile?.full_name ? `· ${profile.full_name}` : ""}
          </button>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
