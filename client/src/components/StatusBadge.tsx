import type { CaseStatus } from "@/lib/types";

const STYLES: Record<CaseStatus, string> = {
  PENDING: "bg-slate-500/15 text-slate-200 border-slate-400/30",
  ANALYZING: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  ACTION_REQUIRED: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  AWAITING_REVIEW: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  APPEAL_READY: "bg-teal-500/15 text-teal-200 border-teal-400/30",
  SUBMITTED: "bg-blue-500/15 text-blue-200 border-blue-400/30",
  VERIFYING: "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
  RESOLVED: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  ESCALATED: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  CLOSED: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
};

const LABELS: Record<CaseStatus, string> = {
  PENDING: "Pending",
  ANALYZING: "Analyzing",
  ACTION_REQUIRED: "Action required",
  AWAITING_REVIEW: "Awaiting review",
  APPEAL_READY: "Appeal ready",
  SUBMITTED: "Submitted",
  VERIFYING: "Verifying",
  RESOLVED: "Resolved",
  ESCALATED: "Escalated",
  CLOSED: "Closed",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
