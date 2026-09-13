"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { MetricsTable } from "@/components/MetricsTable";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { EvalMetric } from "@/lib/types";

export default function EvalPage() {
  const [metrics, setMetrics] = useState<EvalMetric[]>([]);
  const [note, setNote] = useState("Waiting for an eval run from the AI server.");

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
        setNote("Eval results are unavailable until the AI server publishes them.");
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Healthcare only"
        title="Evaluation harness"
        description="Live accuracy, gap F1, routing, safety recall, and citation validity from the 20-case denial suite. Results appear only after a real eval run."
      />
      <p className="text-sm text-muted">{note}</p>
      {metrics.length === 0 ? (
        <EmptyState
          title="No eval results yet"
          description="Run the harness on the AI server. This page will not invent scores."
        />
      ) : (
        <div className="cs-panel overflow-hidden rounded-3xl">
          <MetricsTable metrics={metrics} />
        </div>
      )}
    </div>
  );
}
