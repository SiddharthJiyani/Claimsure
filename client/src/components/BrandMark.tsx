import Link from "next/link";

export function BrandMark({
  href = "/",
  subtitle,
}: {
  href?: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-[15px] font-bold text-[#04201c]">
        C
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight">
          Claimsure
        </span>
        {subtitle ? (
          <span className="block text-[11px] text-muted">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
