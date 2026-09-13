"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Appeal } from "@/lib/types";

export function ApprovalCard({
  appeal,
  onChanged,
}: {
  appeal: Appeal;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked =
    appeal.status === "APPROVED" ||
    appeal.status === "REJECTED" ||
    appeal.status === "ACCEPTED";

  async function decide(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      await apiFetch(`/appeals/${appeal.id}/${action}`, { method: "POST" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">
        Appeal {appeal.status.replaceAll("_", " ").toLowerCase()}
      </p>
      {appeal.appeal_text ? (
        <p className="mt-2 text-sm text-muted">{appeal.appeal_text}</p>
      ) : null}
      {appeal.citations && appeal.citations.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-accent-2">
          {appeal.citations.map((citation) => (
            <li key={`${citation.policy_id}-${citation.clause}`}>
              {citation.policy_id} §{citation.clause}: {citation.text}
            </li>
          ))}
        </ul>
      ) : null}
      {!locked ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void decide("approve")}
            className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-[color:var(--cs-accent-ink)] disabled:opacity-60"
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void decide("reject")}
            className="rounded-xl border border-danger/40 px-3 py-2 text-sm font-medium text-danger disabled:opacity-60"
          >
            {busy === "reject" ? "Rejecting…" : "Reject / escalate"}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
