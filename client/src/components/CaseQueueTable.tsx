import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { relativeTime } from "@/lib/format";
import type { ClaimCase } from "@/lib/types";

export function CaseQueueTable({
  cases,
  hrefFor,
  action,
}: {
  cases: ClaimCase[];
  hrefFor: (claim: ClaimCase) => string;
  action?: (claim: ClaimCase) => React.ReactNode;
}) {
  return (
    <div className="cs-panel overflow-hidden rounded-2xl">
      <div className="hidden grid-cols-[7rem_1fr_10rem_6.5rem_auto] gap-3 border-b border-border px-4 py-2.5 text-xs text-muted md:grid">
        <span>Case</span>
        <span>Service</span>
        <span>Status</span>
        <span>Updated</span>
        <span className="text-right">{action ? "Action" : ""}</span>
      </div>
      <ul>
        {cases.map((claim) => {
          const missing =
            claim.documents?.filter((doc) => doc.is_missing).length ?? 0;
          return (
            <li
              key={claim.id}
              className="grid items-center gap-3 border-t border-border/80 px-4 py-3 first:border-t-0 md:grid-cols-[7rem_1fr_10rem_6.5rem_auto]"
            >
              <Link
                href={hrefFor(claim)}
                className="font-mono text-xs text-muted hover:text-foreground"
              >
                {claim.case_number}
              </Link>
              <div className="min-w-0">
                <Link
                  href={hrefFor(claim)}
                  className="block truncate font-medium hover:text-accent"
                >
                  {claim.service_type}
                </Link>
                <p className="truncate text-xs text-muted">
                  {claim.service_code ?? "CPT pending"}
                  {missing > 0 ? ` · ${missing} missing` : ""}
                </p>
              </div>
              <StatusBadge status={claim.status} />
              <p className="text-xs text-muted">
                {relativeTime(claim.updated_at)}
              </p>
              <div className="flex justify-end gap-2">
                {action?.(claim)}
                <Link
                  href={hrefFor(claim)}
                  className="inline-flex items-center gap-1 text-sm text-accent"
                >
                  Open <ChevronRight size={14} />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
