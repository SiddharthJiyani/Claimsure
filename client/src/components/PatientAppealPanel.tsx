"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Send, Calendar, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ClaimCase } from "@/lib/types";

interface PatientAppealPanelProps {
  claim: ClaimCase;
  onChanged: () => Promise<void> | void;
}

export function PatientAppealPanel({ claim, onChanged }: PatientAppealPanelProps) {
  const latestAppeal = claim.appeals?.[0];
  const denial = claim.denials?.[0];
  const isResolved = claim.status === "RESOLVED";

  // Check if case is in a state eligible for patient appeal
  const canAppeal =
    !isResolved &&
    (claim.status === "AWAITING_REVIEW" ||
      claim.status === "ACTION_REQUIRED" ||
      Boolean(denial?.denial_reason));

  // Starter appeal text if available from agent state or default
  const agentAppealDraft =
    claim.agent_state?.[0]?.state_data?.appeal_letter as string | undefined;

  const [appealText, setAppealText] = useState(
    agentAppealDraft ||
      `I am requesting a formal appeal and re-evaluation of the coverage decision for ${claim.service_type} (${claim.service_code || "Procedure"}). The prescribed treatment is medically necessary based on my treating physician's clinical assessment and meets the criteria outlined in your policy guidelines.`
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    if (!appealText.trim() || appealText.trim().length < 20) {
      setError("Please provide a detailed appeal statement (at least 20 characters).");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccessMsg("");

    try {
      await apiFetch(`/cases/${claim.id}/appeal`, {
        method: "POST",
        body: JSON.stringify({
          appeal_text: appealText.trim(),
        }),
      });

      setSuccess("Your appeal has been submitted directly to your insurance provider for formal re-evaluation. A confirmation email has been sent to you.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit appeal");
    } finally {
      setBusy(false);
    }
  }

  function setSuccessMsg(val: string) {
    setSuccess(val || null);
  }

  if (isResolved) {
    return (
      <div className="cs-panel rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
          <div>
            <h3 className="text-sm font-semibold text-emerald-400">Claim Approved</h3>
            <p className="mt-1 text-xs text-muted">
              Your insurance provider approved coverage for this claim. No appeal is necessary.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-panel rounded-2xl p-6 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="cs-kicker text-accent">Patient Rights & Appeals</span>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {latestAppeal ? "Your Filed Appeal" : "Submit Claim Appeal"}
          </h2>
        </div>
        <div>
          {latestAppeal ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
              Appeal Status: {latestAppeal.status.replace("_", " ")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
              <AlertTriangle size={14} /> Appeal Eligible
            </span>
          )}
        </div>
      </div>

      {/* Denial / Rejection notice if present */}
      {denial && !latestAppeal && (
        <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldAlert size={14} /> Payer Denial / Rejection Reason
          </div>
          <p className="mt-1.5 text-sm text-foreground/90 font-medium">
            {denial.denial_reason}
          </p>
          {denial.appeal_deadline && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
              <Calendar size={13} />
              <span>Deadline to appeal: <strong>{denial.appeal_deadline}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Active appeal details if already submitted */}
      {latestAppeal ? (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-border bg-surface-2/60 p-4">
            <div className="flex items-center justify-between text-xs text-muted mb-2">
              <span className="font-semibold text-foreground">Submitted Statement</span>
              {latestAppeal.created_at && (
                <span>{new Date(latestAppeal.created_at).toLocaleDateString()}</span>
              )}
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {latestAppeal.appeal_text}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted">
            <Send size={13} className="text-accent" />
            <span>Dispatched to: <strong>Insurance Provider Medical Review Team</strong></span>
          </div>
        </div>
      ) : canAppeal ? (
        /* Appeal submission form */
        <form onSubmit={(e) => void submitAppeal(e)} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Your Appeal Justification & Clinical Summary
              <span className="text-danger ml-1">*</span>
            </label>
            <p className="mt-1 text-xs text-muted">
              State why this procedure is medically necessary. Our system references your insurer’s specific coverage policy clauses to bolster your argument.
            </p>
            <textarea
              required
              rows={4}
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              className="cs-input mt-2 w-full text-sm leading-relaxed"
              placeholder="Explain why the treatment is necessary and attach supporting doctor notes..."
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
              {success}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Send size={13} className="text-accent" />
              <span>Recipient: <strong>Insurance Provider</strong> (email notice + review queue)</span>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="cs-btn cs-btn-primary inline-flex items-center gap-2 px-5"
            >
              <FileText size={15} />
              {busy ? "Submitting Appeal…" : "Submit Appeal to Insurance Provider"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 text-xs text-muted">
          Your claim is currently being processed. If the insurer issues a denial or requests action, the appeal submission form will activate here.
        </div>
      )}
    </div>
  );
}
