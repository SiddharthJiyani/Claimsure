import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { relativeTime } from "@/lib/format";
import type { ClaimCase } from "@/lib/types";

export function CaseCard({
  claim,
  href,
  subtitle,
  onRemove,
  removing,
}: {
  claim: ClaimCase;
  href: string;
  subtitle?: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const missing = claim.documents?.filter((doc) => doc.is_missing).length ?? 0;
  return (
    <Link
      href={href}
      className="cs-panel block rounded-2xl p-4 transition hover:border-accent/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h3 className="mt-1 truncate text-base font-semibold">
            {claim.service_type}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {claim.service_code ?? "CPT pending"} ·{" "}
            {subtitle ?? claim.payer_id ?? "Payer pending"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={claim.status} />
          {onRemove &&
          claim.status !== "RESOLVED" &&
          claim.status !== "CLOSED" ? (
            <button
              type="button"
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemove();
              }}
              className="text-xs font-medium text-danger hover:underline disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {missing > 0
            ? `${missing} document${missing === 1 ? "" : "s"} missing`
            : "Evidence complete"}
          <span className="text-border"> · </span>
          {relativeTime(claim.updated_at)}
        </span>
        <span className="inline-flex items-center gap-1 text-accent">
          Open <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}
