import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { ClaimCase } from "@/lib/types";

export function CaseCard({
  claim,
  href,
  subtitle,
}: {
  claim: ClaimCase;
  href: string;
  subtitle?: string;
}) {
  const missing = claim.documents?.filter((doc) => doc.is_missing).length ?? 0;
  return (
    <Link
      href={href}
      className="cs-panel block rounded-2xl p-4 transition hover:border-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h3 className="mt-1 text-base font-semibold">{claim.service_type}</h3>
          <p className="mt-1 text-sm text-muted">
            {claim.service_code ?? "No CPT"} ·{" "}
            {subtitle ?? claim.payer_id ?? "Payer"}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {missing > 0
            ? `${missing} document${missing === 1 ? "" : "s"} missing`
            : "Evidence complete"}
        </span>
        <span className="inline-flex items-center gap-1 text-accent">
          Open <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}
