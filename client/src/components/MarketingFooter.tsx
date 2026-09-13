import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

const FOOTER_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roles", label: "Workspaces" },
  { href: "/#security", label: "Security" },
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Get started" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-sm">
          <BrandMark name="Claimsure AI" />
          <p className="mt-3 text-sm leading-6 text-muted">
            Prior-authorization and denial recovery with an auditable agent for
            patients and healthcare teams.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/70">
        <p className="mx-auto max-w-7xl px-5 py-4 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} Claimsure AI. Built for clinical
          operations, not generic chat.
        </p>
      </div>
    </footer>
  );
}
