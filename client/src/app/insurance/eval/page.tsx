"use client";

import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { MetricsTable } from "@/components/MetricsTable";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { EvalMetric } from "@/lib/types";

const EXPECTED = [
  ["Accuracy", "Correct denial parse + outcome"],
  ["Gap F1", "Missing-document detection"],
  ["Routing", "Rule-based path vs gold"],
  ["Safety recall", "Necessity always to review"],
  ["Citation validity", "Policy clauses that exist"],
];

export default function EvalPage() {
  const [metrics, setMetrics] = useState<EvalMetric[]>([]);
  const [note, setNote] = useState(
    "Waiting for an eval run from the AI server.",
  );

  useEffect(() => {
    apiFetch<{ metrics: EvalMetric[]; cases?: number }>("/eval")
      .then((data) => {
        setMetrics(data.metrics ?? []);
        setNote(
          data.metrics?.length
            ? `Latest harness run${data.cases ? ` · ${data.cases} cases` : ""}.`
            : "No eval results have been published yet.",
        );
      })
      .catch(() => {
        setMetrics([]);
        setNote(
          "Eval results appear only after the AI server publishes a run.",
        );
      });
  }, []);

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Healthcare only"
        title="Evaluation harness"
        description="Accuracy, gap F1, routing, safety recall, and citation validity from the 20-case denial suite. Scores appear only after a real run."
      />
      <p className="text-sm text-muted">{note}</p>
      {metrics.length === 0 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {EXPECTED.map(([name, copy]) => (
              <div key={name} className="cs-panel rounded-2xl p-4">
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-2 text-2xl font-semibold text-muted">—</p>
                <p className="mt-1 text-xs text-muted">{copy}</p>
              </div>
            ))}
          </div>
          <EmptyState
            icon={FileSearch}
            title="No eval results yet"
            description="Run the harness on the AI server. This page will not invent scores."
          />
        </div>
      ) : (
        <div className="cs-panel overflow-hidden rounded-2xl">
          <MetricsTable metrics={metrics} />
        </div>
      )}
    </WorkspaceFrame>
  );
}
