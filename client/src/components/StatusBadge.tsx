import type { CaseStatus } from "@/lib/types";

const STYLES: Record<CaseStatus, string> = {
  PENDING: "cs-status-pending",
  ANALYZING: "cs-status-analyzing",
  ACTION_REQUIRED: "cs-status-action",
  AWAITING_REVIEW: "cs-status-review",
  APPEAL_READY: "cs-status-appeal",
  SUBMITTED: "cs-status-submitted",
  VERIFYING: "cs-status-verifying",
  RESOLVED: "cs-status-resolved",
  ESCALATED: "cs-status-escalated",
  CLOSED: "cs-status-closed",
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
    <span className={`cs-status ${STYLES[status]}`}>{LABELS[status]}</span>
  );
}
