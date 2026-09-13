"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  FileSearch,
  Files,
  FolderOpen,
  Home,
  Inbox,
  LogOut,
  Settings,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/lib/auth-context";
import { roleLabel, type UserRole } from "@/lib/types";

const PATIENT_LINKS = [
  { href: "/patient", label: "Overview", icon: Home },
  { href: "/patient/claims", label: "Claims", icon: FolderOpen },
  { href: "/patient/documents", label: "Documents", icon: Files },
  { href: "/patient/notifications", label: "Alerts", icon: Bell },
  { href: "/patient/settings", label: "Settings", icon: Settings },
];

const INSURER_LINKS = [
  { href: "/insurance", label: "Operations", icon: Activity },
  { href: "/insurance/cases", label: "Case queue", icon: Inbox },
  { href: "/insurance/agent", label: "AI agent", icon: Bot },
  { href: "/insurance/eval", label: "Eval harness", icon: FileSearch },
  { href: "/insurance/notifications", label: "Alerts", icon: Bell },
  { href: "/insurance/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/patient" || href === "/insurance") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const links = role === "patient" ? PATIENT_LINKS : INSURER_LINKS;
  const home = role === "patient" ? "/patient" : "/insurance";

  return (
    <aside className="flex w-full flex-col border-b border-border bg-surface/90 backdrop-blur-xl lg:h-full lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-4">
        <BrandMark href={home} subtitle={`${roleLabel(role)} workspace`} />
        <div className="lg:hidden">
          <NotificationBell />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-accent/12 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_35%,transparent)]"
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
          <p className="truncate text-sm font-medium">
            {profile?.full_name ?? "Signed in"}
          </p>
          <p className="truncate text-xs text-muted">
            {profile?.email ?? roleLabel(role)}
          </p>
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
    <div className="app-canvas flex min-h-full flex-col lg:flex-row">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-between border-b border-border/80 px-6 py-3 lg:flex">
          <p className="text-sm text-muted">
            Prior-auth agent · live workspace
          </p>
          <div className="flex items-center gap-3">
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
              Sign out{profile?.full_name ? ` · ${profile.full_name}` : ""}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
