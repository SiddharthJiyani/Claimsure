"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot } from "lucide-react";
import { AgentTrace } from "@/components/AgentTrace";
import { ApprovalCard } from "@/components/ApprovalCard";
import { CaseTimeline } from "@/components/CaseTimeline";
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

  async function load() {
    try {
      const data = await appFetch<{ case: ClaimCase }>(
        `/api/workspace/cases/${params.id}`,
      );
      setClaim(data.case);
      setError(null);
    } catch {
      try {
        const data = await apiFetch<{ case: ClaimCase }>(`/cases/${params.id}`);
        setClaim(data.case);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load case");
      }
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function trigger() {
    if (!claim) return;
    setBusy(true);
    try {
      await apiFetch(`/cases/${claim.id}/process`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `${claim.id}:process_agent`,
        },
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trigger agent");
    } finally {
      setBusy(false);
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
        </section>
      </div>

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Agent reasoning</p>
        <div className="mt-3">
          <AgentTrace states={claim.agent_state ?? []} />
        </div>
      </section>

      {appeal ? (
        <ApprovalCard appeal={appeal} onChanged={() => void load()} />
      ) : (
        <div className="cs-panel rounded-2xl px-5 py-6 text-sm text-muted">
          No appeal draft yet. Trigger the agent after evidence is complete.
        </div>
      )}

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Audit trail</p>
        <div className="mt-4">
          <CaseTimeline logs={logs} />
        </div>
      </section>
    </WorkspaceFrame>
  );
}
