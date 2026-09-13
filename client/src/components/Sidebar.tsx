"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  ChevronRight,
  FileSearch,
  Files,
  FolderOpen,
  Home,
  Inbox,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";
import { displayName, initials } from "@/lib/format";
import { useCases, useNotifications } from "@/lib/use-workspace-data";
import { roleLabel, type UserRole } from "@/lib/types";

const SIDEBAR_KEY = "claimsure-sidebar";

const PATIENT_SECTIONS = [
  {
    label: "Care",
    links: [
      { href: "/patient", label: "Overview", icon: Home, badge: "open" as const },
      { href: "/patient/claims", label: "Claims", icon: FolderOpen, badge: "all" as const },
      { href: "/patient/documents", label: "Documents", icon: Files },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/patient/notifications", label: "Alerts", icon: Bell, badge: "alerts" as const },
      { href: "/patient/settings", label: "Settings", icon: Settings },
    ],
  },
];

const INSURER_SECTIONS = [
  {
    label: "Review",
    links: [
      { href: "/insurance", label: "Operations", icon: Activity, badge: "open" as const },
      { href: "/insurance/cases", label: "Case queue", icon: Inbox, badge: "open" as const },
    ],
  },
  {
    label: "Intelligence",
    links: [
      { href: "/insurance/agent", label: "AI agent", icon: Bot, badge: "open" as const },
      { href: "/insurance/eval", label: "Eval harness", icon: FileSearch },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/insurance/notifications", label: "Alerts", icon: Bell, badge: "alerts" as const },
      { href: "/insurance/settings", label: "Settings", icon: Settings },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/patient": "Patient overview",
  "/patient/claims": "My claims",
  "/patient/documents": "Documents",
  "/patient/notifications": "Alerts",
  "/patient/settings": "Settings",
  "/insurance": "Operations desk",
  "/insurance/cases": "Case queue",
  "/insurance/agent": "AI agent",
  "/insurance/eval": "Eval harness",
  "/insurance/notifications": "Alerts",
  "/insurance/settings": "Settings",
};

function isActive(pathname: string, href: string) {
  if (href === "/patient" || href === "/insurance") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/insurance/cases/")) return "Case detail";
  if (pathname.startsWith("/patient/cases/")) return "Claim detail";
  return "Workspace";
}

function NavBadge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function Sidebar({
  role,
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  role: UserRole;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const { cases } = useCases();
  const { items } = useNotifications();
  const sections = role === "patient" ? PATIENT_SECTIONS : INSURER_SECTIONS;
  const home = role === "patient" ? "/patient" : "/insurance";
  const name = displayName({
    fullName: profile?.full_name,
    email: profile?.email ?? user?.email,
  });
  const openCount = useMemo(
    () =>
      cases.filter((claim) => !["RESOLVED", "CLOSED"].includes(claim.status))
        .length,
    [cases],
  );
  const unread = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );

  function badgeFor(kind?: "open" | "all" | "alerts") {
    if (kind === "open") return openCount;
    if (kind === "all") return cases.length;
    if (kind === "alerts") return unread;
    return 0;
  }

  const nav = (
    <>
      <div className={`flex items-center px-3 py-4 ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
        <BrandMark
          href={home}
          subtitle={`${roleLabel(role)} workspace`}
          compact={collapsed}
        />
        <button
          type="button"
          onClick={onCloseMobile}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted lg:hidden"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {!collapsed ? (
        <div className="mx-3 mb-3 rounded-xl border border-border bg-background/70 px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">{roleLabel(role)}</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              Live
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {profile?.organization_name ??
              (role === "patient" ? "Personal workspace" : "Organization desk")}
          </p>
        </div>
      ) : null}

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {sections.map((section) => (
          <div key={section.label}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" />
            ) : (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {section.label}
              </p>
            )}
            <div className="space-y-1">
              {section.links.map((link) => {
                const active = isActive(pathname, link.href);
                const LinkIcon = link.icon;
                const count = badgeFor(link.badge);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                      collapsed ? "justify-center px-0" : ""
                    } ${
                      active
                        ? "bg-accent/12 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {active ? (
                      <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />
                    ) : null}
                    <LinkIcon size={16} className="shrink-0" />
                    {collapsed ? (
                      count > 0 ? (
                        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />
                      ) : null
                    ) : (
                      <>
                        <span>{link.label}</span>
                        <NavBadge value={count} />
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mt-auto space-y-3 border-t border-border px-3 py-3 ${collapsed ? "px-2" : ""}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle compact />
          </div>
        ) : (
          <ThemeToggle />
        )}

        <div className={`flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-semibold text-accent">
            {initials(name)}
          </div>
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted">
                {profile?.email ?? user?.email ?? roleLabel(role)}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login");
              router.refresh();
            }}
            className="rounded-xl border border-border p-2 text-muted hover:text-foreground"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface/95 shadow-[var(--shadow-panel)] backdrop-blur-xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${
          collapsed ? "lg:w-[4.75rem]" : "lg:w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {nav}
      </aside>
    </>
  );
}

export function AppShell({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const name = displayName({
    fullName: profile?.full_name,
    email: profile?.email ?? user?.email,
  });

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "collapsed");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      return next;
    });
  }

  return (
    <div className="app-canvas flex min-h-full flex-col lg:flex-row">
      <Sidebar
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/80 bg-background/70 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={16} />
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 place-items-center rounded-xl border border-border text-muted hover:text-foreground lg:grid"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{pageTitle(pathname)}</p>
              <p className="truncate text-xs text-muted">
                {roleLabel(role)} · live workspace
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <NotificationBell />
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/login");
                router.refresh();
              }}
              className="hidden rounded-xl border border-border bg-surface/80 px-3 py-1.5 text-sm text-muted hover:text-foreground sm:inline-flex"
            >
              Sign out
              {profile?.full_name || user?.email ? ` · ${name}` : ""}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
