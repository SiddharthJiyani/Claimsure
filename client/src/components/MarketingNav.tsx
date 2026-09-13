"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roles", label: "Workspaces" },
  { href: "/#security", label: "Security" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="cs-header relative sticky top-0 z-30 border-b border-border/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <BrandMark name="Claimsure AI" />

        <nav
          className="hidden items-center gap-1 text-sm lg:flex"
          aria-label="Marketing"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link
            href="/login"
            className="cs-btn cs-btn-ghost hidden px-3.5 py-2 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/signup" className="cs-btn cs-btn-primary px-3.5 py-2">
            Get started
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-muted lg:hidden"
            aria-expanded={open}
            aria-controls="marketing-nav-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="marketing-nav-menu"
          className="absolute inset-x-0 top-full border-b border-border bg-background/97 px-5 py-4 shadow-lg backdrop-blur-xl lg:hidden"
        >
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground sm:hidden"
            >
              Sign in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
