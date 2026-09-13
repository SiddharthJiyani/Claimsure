import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#roles", label: "Roles" },
  { href: "/#reliability", label: "Reliability" },
];

export function MarketingNav() {
  return (
    <header className="cs-header sticky top-0 z-30 border-b border-border/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <BrandMark />
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/login" className="cs-btn cs-btn-ghost px-3 py-2">
            Sign in
          </Link>
          <Link href="/signup" className="cs-btn cs-btn-primary px-3 py-2">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
