"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileSearch,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton, StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch, appFetch } from "@/lib/api";
import {
  neededForProviders,
  nextStepForProviders,
  providerStats,
  toEvalDashboard,
} from "@/lib/eval-results";
import { summarizeService } from "@/lib/format";
import type { CaseStatus, EvalCaseRow, EvalDashboard } from "@/lib/types";

const CASE_STATUSES: CaseStatus[] = [
  "PENDING",
  "ANALYZING",
  "ACTION_REQUIRED",
  "AWAITING_REVIEW",
  "APPEAL_READY",
  "SUBMITTED",
  "VERIFYING",
  "RESOLVED",
  "ESCALATED",
  "CLOSED",
];

function asCaseStatus(value: string): CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus)
    ? (value as CaseStatus)
    : "AWAITING_REVIEW";
}

function sortClaims(rows: EvalCaseRow[]) {
  const rank = (status: string) => {
    if (status === "ACTION_REQUIRED") return 0;
    if (status === "ESCALATED") return 1;
    if (["AWAITING_REVIEW", "APPEAL_READY", "ANALYZING"].includes(status)) {
      return 2;
    }
    if (["RESOLVED", "SUBMITTED", "CLOSED"].includes(status)) return 4;
    return 3;
  };
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}

export default function EvalPage() {
  const [data, setData] = useState<EvalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const mapped = await appFetch<EvalDashboard>("/api/workspace/eval");
      setData(mapped);
    } catch {
      try {
        const raw = await apiFetch<unknown>("/eval/results");
        const mapped = toEvalDashboard(raw);
        if (!mapped.details.length) {
          throw new Error("No cases to review");
        }
        setData(mapped);
      } catch (err) {
        setData(null);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load evaluation results",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(
    () => (data ? providerStats(data.details) : null),
    [data],
  );
  const rows = useMemo(
    () => (data ? sortClaims(data.details) : []),
    [data],
  );

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Healthcare only"
        title="Evaluation harness"
        description="A plain-language view of every claim in this workspace: what is waiting, what is missing, and what to do next."
      />

      {loading ? <QueueSkeleton rows={6} /> : null}
      {error ? <ErrorCallout message={error} onRetry={() => void load()} /> : null}

      {!loading && data && stats ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Claims in workspace"
              value={stats.total}
              hint="Every live claim"
              icon={ClipboardList}
            />
            <StatCard
              label="Waiting on patient"
              value={stats.waitingOnPatient}
              hint="Open claims missing records"
              icon={UserRound}
            />
            <StatCard
              label="Ready for review"
              value={stats.readyForReview}
              hint="With the reviewer or agent"
              icon={FileSearch}
            />
            <StatCard
              label="Escalated"
              value={stats.escalated}
              hint="Clinical safety review"
              icon={ShieldAlert}
            />
            <StatCard
              label="Finished"
              value={stats.finished}
              hint="Submitted, resolved, or closed"
              icon={CheckCircle2}
            />
          </div>

          <section className="space-y-3">
            <div>
              <p className="cs-kicker">Claim checklist</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Open a claim to request records or continue review. Action items
                are listed first.
              </p>
            </div>
            <ul className="space-y-3">
              {rows.map((row) => {
                const service = summarizeService(row.service_type);
                const needed = neededForProviders(row);
                const next = nextStepForProviders(row);
                const waiting =
                  !["RESOLVED", "CLOSED", "SUBMITTED"].includes(row.status) &&
                  (row.status === "ACTION_REQUIRED" ||
                    row.actual_missing.length > 0);
                const inner = (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted">
                          {row.case_number}
                        </p>
                        <h3 className="mt-1 text-base font-semibold leading-snug">
                          {service.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted">
                          {service.meta || row.service_code || "Code pending"}
                        </p>
                      </div>
                      <StatusBadge status={asCaseStatus(row.status)} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Still needed
                        </p>
                        <p
                          className={`mt-1 inline-flex items-start gap-1.5 text-sm leading-6 ${
                            waiting ? "text-warn" : "text-muted"
                          }`}
                        >
                          {waiting ? (
                            <AlertTriangle size={14} className="mt-1 shrink-0" />
                          ) : null}
                          <span className="line-clamp-2">{needed}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Next step
                        </p>
                        <p className="mt-1 text-sm leading-6">{next}</p>
                      </div>
                    </div>
                    {row.case_id ? (
                      <p className="mt-3 inline-flex items-center gap-1 text-xs text-accent">
                        Open claim <ChevronRight size={14} />
                      </p>
                    ) : null}
                  </>
                );

                return (
                  <li key={row.case_number}>
                    {row.case_id ? (
                      <Link
                        href={`/insurance/cases/${row.case_id}`}
                        className="cs-panel block rounded-2xl p-5 transition hover:border-accent/35"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="cs-panel rounded-2xl p-5">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}

      {!loading && !data && !error ? (
        <EmptyState
          icon={FileSearch}
          title="No claims to evaluate"
          description="When claims exist in this workspace, they appear here with a clear next step."
        />
      ) : null}
    </WorkspaceFrame>
  );
}
