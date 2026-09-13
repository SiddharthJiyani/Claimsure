"use client";

import { Bot } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import { useCases } from "@/lib/use-workspace-data";
import { useState } from "react";

const NODES = [
  "parse_denial",
  "retrieve_requirements",
  "scan_evidence",
  "compute_gap",
  "route",
  "act",
  "await_human",
  "assemble_appeal",
  "verify",
];

export default function InsuranceAgentPage() {
  const { cases, error, reload } = useCases();
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Healthcare"
        title="AI agent console"
        description="Trigger the 9-node denial workflow. Routing is rule-based; medical necessity always goes to human review."
      />

      <section className="cs-panel rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          State machine
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {NODES.map((node, index) => (
            <div
              key={node}
              className="rounded-2xl border border-border bg-background/50 px-3 py-3 text-sm"
            >
              <p className="font-mono text-[11px] text-muted">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="mt-1 font-medium">{node.replaceAll("_", " ")}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {runnable.length === 0 ? (
        <EmptyState
          title="No runnable cases"
          description="The agent runs on real org cases. Submit or wait for a patient claim first."
        />
      ) : (
        <div className="space-y-3">
          {runnable.map((claim) => (
            <div
              key={claim.id}
              className="cs-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4"
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
    </div>
  );
}
