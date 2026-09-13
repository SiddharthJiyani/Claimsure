import { Check, X } from "lucide-react";
import type { EvalMetric } from "@/lib/types";

export function MetricsTable({ metrics }: { metrics: EvalMetric[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Metric</th>
            <th className="px-4 py-3 font-medium">Result</th>
            <th className="px-4 py-3 font-medium">Target</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.name} className="border-t border-border bg-surface">
              <td className="px-4 py-3">{metric.name}</td>
              <td className="px-4 py-3 font-mono">{metric.value}</td>
              <td className="px-4 py-3 text-muted">{metric.target}</td>
              <td className="px-4 py-3">
                {metric.pass ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Check size={14} /> Pass
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger">
                    <X size={14} /> Fail
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
