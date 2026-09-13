import Link from "next/link";

export function BrandMark({
  href = "/",
  subtitle,
  compact = false,
}: {
  href?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-[15px] font-bold text-[color:var(--accent-ink)]">
        C
      </span>
      {compact ? (
        <span className="sr-only">Claimsure</span>
      ) : (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">
            Claimsure
          </span>
          {subtitle ? (
            <span className="block truncate text-xs text-muted">{subtitle}</span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
