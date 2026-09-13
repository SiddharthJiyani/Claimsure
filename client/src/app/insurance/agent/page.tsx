"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { useCases } from "@/lib/use-workspace-data";

const NODES = [
  ["Parse denial", "Extract codes, dates, and reason language."],
  ["Retrieve policy", "Pull payer medical-necessity clauses."],
  ["Scan evidence", "Map uploaded records to required docs."],
  ["Compute gap", "Score what is still missing."],
  ["Route", "Rule-based path. Necessity always goes to review."],
  ["Act", "Request records or draft the next step."],
  ["Await review", "Hold for a healthcare decision."],
  ["Assemble appeal", "Write a citation-backed letter."],
  ["Verify", "Check citations before submit."],
];

export default function InsuranceAgentPage() {
  const { cases, error, loading, reload } = useCases();
  const [busyId, setBusyId] = useState<string | null>(null);
  const runnable = cases.filter(
    (claim) => !["RESOLVED", "CLOSED"].includes(claim.status),
  );

  async function trigger(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/cases/${id}/analyze`, { method: "POST" });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Healthcare"
        title="AI agent console"
        description="Nine-node denial workflow. Routing is rule-based; medical necessity always stops for a human."
      />

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">State machine</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {NODES.map(([title, copy], index) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface-2/80 px-3.5 py-3"
            >
              <p className="font-mono text-[11px] text-accent">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Runnable cases</h2>
          <p className="mt-1 text-sm text-muted">
            The agent only runs on live organization claims.
          </p>
        </div>
        {loading ? (
          <QueueSkeleton />
        ) : runnable.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No runnable cases"
            description="Submit a patient claim first, or wait for one to arrive. The console will not invent work."
          />
        ) : (
          <div className="cs-panel divide-y divide-border overflow-hidden rounded-2xl">
            {runnable.map((claim) => (
              <div
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
              >
                <div>
                  <p className="font-mono text-xs text-muted">
                    {claim.case_number}
                  </p>
                  <p className="font-semibold">{claim.service_type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={claim.status} />
                  <button
                    type="button"
                    disabled={busyId === claim.id}
                    onClick={() => void trigger(claim.id)}
                    className="cs-btn cs-btn-primary"
                  >
                    <Bot size={16} />
                    {busyId === claim.id ? "Queuing…" : "Run agent"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </WorkspaceFrame>
  );
}
