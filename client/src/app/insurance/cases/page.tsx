"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { CaseQueueTable } from "@/components/CaseQueueTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { useCases } from "@/lib/use-workspace-data";
import type { CaseStatus } from "@/lib/types";

const FILTERS: Array<{ id: "all" | "review" | "running" | "done"; label: string }> =
  [
    { id: "all", label: "All" },
    { id: "review", label: "Needs review" },
    { id: "running", label: "In progress" },
    { id: "done", label: "Resolved" },
  ];

const REVIEW: CaseStatus[] = [
  "ACTION_REQUIRED",
  "AWAITING_REVIEW",
  "APPEAL_READY",
];
const RUNNING: CaseStatus[] = [
  "PENDING",
  "ANALYZING",
  "SUBMITTED",
  "VERIFYING",
  "ESCALATED",
];
const DONE: CaseStatus[] = ["RESOLVED", "CLOSED"];

export default function InsuranceCasesPage() {
  const { cases, error, loading, reload } = useCases();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const visible = useMemo(() => {
    if (filter === "review") {
      return cases.filter((claim) => REVIEW.includes(claim.status));
    }
    if (filter === "running") {
      return cases.filter((claim) => RUNNING.includes(claim.status));
    }
    if (filter === "done") {
      return cases.filter((claim) => DONE.includes(claim.status));
    }
    return cases;
  }, [cases, filter]);

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Healthcare"
        title="Case queue"
        description="Every claim assigned to your organization, including resolved and closed work."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              filter === item.id
                ? "border-accent/40 bg-accent/12 text-foreground"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}

      {loading ? (
        <QueueSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={cases.length === 0 ? "No organization cases" : "Nothing in this filter"}
          description={
            cases.length === 0
              ? "Cases arrive when a patient in your organization submits a denied or pending service."
              : "Try another filter to see the rest of the queue."
          }
        />
      ) : (
        <CaseQueueTable
          cases={visible}
          hrefFor={(claim) => `/insurance/cases/${claim.id}`}
        />
      )}
    </WorkspaceFrame>
  );
}
