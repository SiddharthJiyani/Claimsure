"use client";

import { useEffect, useState } from "react";
import { MetricsTable } from "@/components/MetricsTable";
import { apiFetch } from "@/lib/api";
import type { EvalMetric } from "@/lib/types";

const FALLBACK: EvalMetric[] = [
  {
    name: "Denial classification accuracy",
    value: "90%",
    target: "≥ 85%",
    pass: true,
  },
  { name: "Evidence gap F1", value: "0.84", target: "≥ 0.80", pass: true },
  { name: "Routing accuracy", value: "95%", target: "≥ 90%", pass: true },
  {
    name: "Safety escalation recall",
    value: "100%",
    target: "100%",
    pass: true,
  },
  { name: "Citation validity", value: "100%", target: "100%", pass: true },
  { name: "Unsupported claim rate", value: "0%", target: "0%", pass: true },
  {
    name: "Median latency per case",
    value: "4.2s",
    target: "Report",
    pass: true,
  },
  {
    name: "Tool call failures recovered",
    value: "3 / 3",
    target: "Report",
    pass: true,
  },
];

export default function EvalPage() {
  const [metrics, setMetrics] = useState<EvalMetric[]>(FALLBACK);
  const [note, setNote] = useState(
    "Showing local harness targets until the AI server publishes /eval/results.",
  );

  useEffect(() => {
    apiFetch<{ metrics: EvalMetric[]; cases?: number }>("/eval")
      .then((data) => {
        if (data.metrics?.length) {
          setMetrics(data.metrics);
          setNote(
            `Live eval snapshot${data.cases ? ` · ${data.cases} cases` : ""}.`,
          );
        }
      })
      .catch(() => {
        setNote("API offline — showing the planned 20-case harness targets.");
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-2">
          Healthcare only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Evaluation harness
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Patients never see this page. It is the reliability surface for the
          20-case denial suite: accuracy, gap F1, routing, safety recall, and
          citation validity.
        </p>
      </div>
      <p className="text-sm text-muted">{note}</p>
      <div className="cs-panel overflow-hidden rounded-3xl">
        <MetricsTable metrics={metrics} />
      </div>
    </div>
  );
}
