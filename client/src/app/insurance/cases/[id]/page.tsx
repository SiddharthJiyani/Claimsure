"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { AgentTrace } from "@/components/AgentTrace";
import { ApprovalCard } from "@/components/ApprovalCard";
import { CaseTimeline } from "@/components/CaseTimeline";
import { EvidencePanel } from "@/components/EvidencePanel";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import type { ClaimCase } from "@/lib/types";

export default function InsuranceCasePage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ case: ClaimCase }>(`/cases/${params.id}`);
      setClaim(data.case);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load case");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function trigger() {
    if (!claim) return;
    setBusy(true);
    try {
      await apiFetch(`/cases/${claim.id}/analyze`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trigger agent");
    } finally {
      setBusy(false);
    }
  }

  if (!claim) {
    return <p className="text-sm text-muted">{error ?? "Loading case…"}</p>;
  }

  const denial = claim.denials?.[0];
  const appeal = claim.appeals?.[0];
  const logs = [...(claim.audit_logs ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h1 className="mt-1 text-3xl font-semibold">{claim.service_type}</h1>
          <p className="mt-1 text-sm text-muted">
            {claim.service_code ?? "CPT pending"} · payer{" "}
            {claim.payer_id ?? "unknown"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={claim.status} />
          <button
            type="button"
            disabled={busy}
            onClick={() => void trigger()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            <Bot size={16} />
            {busy ? "Queuing…" : "Trigger AI agent"}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Denial</h2>
          <p className="mt-2 text-sm text-muted">
            {denial?.denial_reason ?? "No denial letter parsed yet."}
          </p>
          {denial?.denial_code ? (
            <p className="mt-2 font-mono text-xs text-accent">
              {denial.denial_code}
            </p>
          ) : null}
        </section>
        <section className="rounded-3xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">Evidence</h2>
          <div className="mt-3">
            <EvidencePanel documents={claim.documents ?? []} />
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Agent reasoning</h2>
        <div className="mt-3">
          <AgentTrace states={claim.agent_state ?? []} />
        </div>
      </section>

      {appeal ? (
        <ApprovalCard appeal={appeal} onChanged={() => void load()} />
      ) : (
        <p className="text-sm text-muted">
          No appeal draft yet. Trigger the agent to generate one after evidence
          is complete.
        </p>
      )}

      <section className="rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Audit trail</h2>
        <div className="mt-4">
          <CaseTimeline logs={logs} />
        </div>
      </section>
    </div>
  );
}
