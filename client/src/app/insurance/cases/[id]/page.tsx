"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot } from "lucide-react";
import { AgentTrace } from "@/components/AgentTrace";
import { InsurerDecisionPanel } from "@/components/InsurerDecisionPanel";
import { CaseTimeline } from "@/components/CaseTimeline";
import { ConnectedServicesPanel } from "@/components/ConnectedServicesPanel";
import { ErrorCallout } from "@/components/ErrorCallout";
import { EvidencePanel } from "@/components/EvidencePanel";
import { WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch, appFetch } from "@/lib/api";
import type { ClaimCase } from "@/lib/types";

export default function InsuranceCasePage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [requesting, setRequesting] = useState(false);

  async function load() {
    try {
      const data = await appFetch<{ case?: ClaimCase; data?: ClaimCase }>(
        `/api/workspace/cases/${params.id}`,
      );
      const c = data.case ?? data.data ?? (data as unknown as ClaimCase);
      if (c && c.id) {
        setClaim(c);
        setError(null);
        return;
      }
    } catch {
      // fallback to backend express API
    }

    try {
      const data = await apiFetch<{ case?: ClaimCase; data?: ClaimCase }>(`/cases/${params.id}`);
      const c = data.case ?? data.data ?? (data as unknown as ClaimCase);
      if (c && c.id) {
        setClaim(c);
        setError(null);
      } else {
        setError("Could not load case details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load case");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  useEffect(() => {
    if (
      claim?.status !== "ANALYZING" &&
      claim?.status !== "ACTION_REQUIRED"
    ) {
      return;
    }
    const interval = setInterval(() => {
      void load();
    }, claim.status === "ANALYZING" ? 1500 : 8000);
    return () => clearInterval(interval);
  }, [claim?.status]);

  async function trigger() {
    if (!claim) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/cases/${claim.id}/process`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `${claim.id}:process_${Date.now()}`,
        },
        body: JSON.stringify({}),
      });
      await load();
      setTimeout(() => { void load(); }, 1500);
      setTimeout(() => { void load(); }, 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trigger agent");
    } finally {
      setBusy(false);
    }
  }

  async function requestRecords(event: React.FormEvent) {
    event.preventDefault();
    if (!claim) return;
    const labels = requestText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!labels.length) return;
    setRequesting(true);
    setError(null);
    try {
      await appFetch(`/api/workspace/cases/${claim.id}/request-documents`, {
        method: "POST",
        body: JSON.stringify({ labels }),
      });
      setRequestText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request records");
    } finally {
      setRequesting(false);
    }
  }

  if (!claim) {
    return (
      <WorkspaceFrame>
        {error ? (
          <ErrorCallout message={error} onRetry={() => void load()} />








        ) : (
          <QueueSkeleton rows={5} />
        )}
      </WorkspaceFrame>
    );
  }

  const denial = claim.denials?.[0];
  const appeal = claim.appeals?.[0];
  const logs = [...(claim.audit_logs ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latestAgent = [...(claim.agent_state ?? [])].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
  const agentData = latestAgent?.state_data ?? {};
  const policyRequirements = Array.isArray(agentData.policy_requirements)
    ? agentData.policy_requirements.filter(
        (item): item is { citation?: string; clause_title?: string; text?: string } =>
          Boolean(item && typeof item === "object"),
      )
    : [];
  const missingEvidence = Array.isArray(agentData.evidence_missing)
    ? agentData.evidence_missing.filter((item): item is string => typeof item === "string")
    : [];
  const foundEvidence = Array.isArray(agentData.evidence_found)
    ? agentData.evidence_found.filter((item): item is string => typeof item === "string")
    : [];
  const patientResponses = logs.filter((log) =>
    ["missing_document_uploaded", "document_uploaded"].includes(log.action),
  );
  const missingDocs = (claim.documents ?? []).filter((doc) => doc.is_missing);

  return (
    <WorkspaceFrame>
      <Link
        href="/insurance/cases"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight">
            {claim.service_type}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {claim.service_code ?? "CPT pending"} · payer{" "}
            {claim.payer_id ?? "pending"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={claim.status} />
          <button
            type="button"
            disabled={busy}
            onClick={() => void trigger()}
            className="cs-btn cs-btn-primary"
          >
            <Bot size={16} />
            {busy ? "Queuing…" : "Trigger AI agent"}
          </button>
        </div>
      </div>

      {error ? (
        <ErrorCallout message={error} onRetry={() => void load()} />
      ) : null}

      {patientResponses.length ? (
        <section className="cs-panel rounded-2xl border border-accent/35 p-5">
          <p className="cs-kicker">Patient responded</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            The patient uploaded records after you asked for action. Review the
            updated packet, then trigger the agent again if you want a new
            coverage check.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {patientResponses.slice(0, 5).map((log) => (
              <li key={log.id} className="text-muted">
                {log.action.replaceAll("_", " ")}
                {(() => {
                  const meta = log.metadata;
                  const label =
                    meta && typeof meta.name === "string"
                      ? meta.name
                      : meta && typeof meta.document_name === "string"
                        ? meta.document_name
                        : "";
                  return label ? ` — ${label}` : "";
                })()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cs-panel rounded-2xl p-5">
          <p className="cs-kicker">Denial</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            {denial?.denial_reason ?? "No denial letter parsed yet."}
          </p>
          {denial?.denial_code ? (
            <p className="mt-3 font-mono text-xs text-accent">
              {denial.denial_code}
            </p>
          ) : null}
        </section>
        <section className="cs-panel rounded-2xl p-5">
          <p className="cs-kicker">Evidence</p>
          <div className="mt-3">
            <EvidencePanel documents={claim.documents ?? []} />
          </div>
          <form onSubmit={requestRecords} className="mt-5 space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Ask the patient for records</p>
            <p className="text-xs text-muted">
              One document name per line. The patient gets an alert and a
              checklist on their claim.
            </p>
            <textarea
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              rows={3}
              placeholder={"MRI report\nClinical note from last visit"}
              className="cs-input min-h-20"
            />
            <button
              type="submit"
              disabled={requesting || !requestText.trim()}
              className="cs-btn cs-btn-primary"
            >
              {requesting ? "Sending…" : "Request from patient"}
            </button>
            {missingDocs.length ? (
              <p className="text-xs text-warn">
                Waiting on {missingDocs.length} requested{" "}
                {missingDocs.length === 1 ? "record" : "records"}.
              </p>
            ) : null}
          </form>
        </section>
      </div>

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Agent reasoning</p>
        <div className="mt-3">
          <AgentTrace states={claim.agent_state ?? []} />
        </div>
      </section>

      <ConnectedServicesPanel claim={claim} />

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Policy comparison</p>
        <p className="mt-2 text-sm text-muted">
          The agent compares the denial and uploaded evidence against the policy
          clauses returned by the configured payer policy corpus.
        </p>
        {policyRequirements.length ? (
          <ul className="mt-4 space-y-2">
            {policyRequirements.map((requirement, index) => (
              <li
                key={`${requirement.citation ?? requirement.clause_title ?? "clause"}-${index}`}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
              >
                <p className="font-medium text-accent">
                  {requirement.citation ?? requirement.clause_title ?? "Policy clause"}
                </p>
                {requirement.text ? (
                  <p className="mt-1 text-muted">{requirement.text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-warn">
            No policy clauses were matched. The agent should not auto-submit this case.
          </p>
        )}
        {foundEvidence.length || missingEvidence.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-success">
                Evidence found
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {foundEvidence.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-warn">
                Evidence missing
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {missingEvidence.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <InsurerDecisionPanel
        claim={claim}
        onChanged={() => void load()}
      />

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Audit trail</p>
        <div className="mt-4">
          <CaseTimeline logs={logs} />
        </div>
      </section>
    </WorkspaceFrame>
  );
}
