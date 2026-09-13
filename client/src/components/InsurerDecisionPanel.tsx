"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, Send, ShieldCheck, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Appeal, ClaimCase } from "@/lib/types";

interface InsurerDecisionPanelProps {
  claim: ClaimCase;
  onChanged: () => Promise<void> | void;
}

export function InsurerDecisionPanel({ claim, onChanged }: InsurerDecisionPanelProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Check if patient has submitted an active appeal
  const latestAppeal = claim.appeals?.[0];
  const hasPendingAppeal = latestAppeal && latestAppeal.status === "PENDING_REVIEW";
  const isResolved = claim.status === "RESOLVED";

  // Find existing decision from agent state or audit log
  const decisionLog = claim.audit_logs?.find(
    (l) => l.action === "claim_accepted" || l.action === "claim_rejected" || l.action === "appeal_accepted" || l.action === "appeal_rejected"
  );

  async function handleClaimDecision(decision: "ACCEPTED" | "REJECTED") {
    if (!reason.trim() || reason.trim().length < 10) {
      setError("Please provide a detailed medical necessity or policy reason (at least 10 characters).");
      return;
    }

    setBusy(decision);
    setError(null);
    setSuccessMsg(null);

    try {
      if (hasPendingAppeal) {
        // Decide on patient's appeal
        await apiFetch(`/cases/${claim.id}/appeal-decision`, {
          method: "POST",
          body: JSON.stringify({
            decision,
            reason: reason.trim(),
          }),
        });
        setSuccessMsg(
          decision === "ACCEPTED"
            ? "Appeal accepted! Claim marked resolved and patient notified via email."
            : "Appeal rejected. Decision documented and patient notified."
        );
      } else {
        // Initial claim determination
        await apiFetch(`/cases/${claim.id}/decision`, {
          method: "POST",
          body: JSON.stringify({
            decision,
            reason: reason.trim(),
          }),
        });
        setSuccessMsg(
          decision === "ACCEPTED"
            ? "Claim accepted! Marked resolved and patient notified via email."
            : "Claim rejected. Patient notified via email with instructions on submitting an appeal."
        );
      }

      setReason("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record determination");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cs-panel rounded-2xl p-6 border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <span className="cs-kicker text-accent">Payer Determination</span>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {hasPendingAppeal ? "Review Patient Appeal" : "Claim Coverage Decision"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isResolved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={14} /> Claim Approved
            </span>
          ) : claim.status === "AWAITING_REVIEW" && decisionLog ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/20">
              <XCircle size={14} /> Claim Rejected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
              <ShieldCheck size={14} /> Decision Pending
            </span>
          )}
        </div>
      </div>

      {/* If there is a pending patient appeal, show it prominently */}
      {hasPendingAppeal && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <FileText size={16} />
            <span>Patient Appeal Statement Submitted</span>
          </div>
          <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {latestAppeal.appeal_text}
          </p>
          {latestAppeal.citations && latestAppeal.citations.length > 0 && (
            <div className="mt-3 border-t border-amber-500/20 pt-2">
              <p className="text-xs font-medium text-amber-300">Cited Policy Clauses:</p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {latestAppeal.citations.map((c, i) => (
                  <li key={i}>• {c.policy_id} §{c.clause}: {c.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Decision feedback messages */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Decision input form */}
      {!isResolved && (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">
              {hasPendingAppeal
                ? "Appeal Review Justification / Clinical Finding"
                : "Medical Necessity & Coverage Determination Reason"}
              <span className="text-danger ml-1">*</span>
            </label>
            <p className="mt-1 text-xs text-muted">
              Document your clinical or policy criteria. This will be automatically dispatched to the patient via email (Nodemailer) and logged in Google Sheets & the Audit Trail.
            </p>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                hasPendingAppeal
                  ? "e.g. Additional conservative therapy documentation provided meets Clause 4.2 criteria; claim approved on appeal."
                  : "e.g. Prior authorization approved based on MRI lumbar clinical evidence, or Missing 6 weeks physical therapy trial per Clause 3.1."
              }
              className="cs-input mt-2 w-full text-sm leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Send size={13} className="text-accent" />
              <span>Recipient: <strong>Patient</strong> (via email & dashboard)</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleClaimDecision("REJECTED")}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition"
              >
                <XCircle size={16} />
                {busy === "REJECTED"
                  ? "Rejecting…"
                  : hasPendingAppeal
                  ? "Uphold Rejection"
                  : "Reject Claim"}
              </button>

              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void handleClaimDecision("ACCEPTED")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
              >
                <CheckCircle2 size={16} />
                {busy === "ACCEPTED"
                  ? "Approving…"
                  : hasPendingAppeal
                  ? "Accept Appeal (Overturn)"
                  : "Accept Claim (Approve)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical decision log if resolved or rejected */}
      {decisionLog && (
        <div className="mt-5 rounded-xl border border-border bg-surface-2/60 p-4 text-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="font-semibold text-foreground">
              Last Decision: {decisionLog.action.replace("_", " ").toUpperCase()}
            </span>
            <span>{new Date(decisionLog.created_at).toLocaleString()}</span>
          </div>
          {Boolean(decisionLog.metadata?.decision_reason) && (
            <p className="mt-2 text-foreground/80 leading-relaxed">
              Reason: {String(decisionLog.metadata?.decision_reason)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
