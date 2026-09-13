"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCases } from "@/lib/use-workspace-data";

export default function InsuranceDashboardPage() {
  const { profile } = useAuth();
  const { cases, error, reload, setError } = useCases();
  const [busyId, setBusyId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      incoming: cases.length,
      action: cases.filter((claim) =>
        ["ACTION_REQUIRED", "AWAITING_REVIEW", "APPEAL_READY"].includes(
          claim.status,
        ),
      ).length,
      analyzing: cases.filter((claim) => claim.status === "ANALYZING").length,
      resolved: cases.filter((claim) => claim.status === "RESOLVED").length,
    }),
    [cases],
  );

  async function seedDemo() {
    try {
      await apiFetch("/demo/seed", { method: "POST" });
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load demo cases",
      );
    }
  }

  async function trigger(id: string) {
    setBusyId(id);
    try {
      await apiFetch(`/cases/${id}/analyze`, { method: "POST" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trigger agent");
    } finally {
      setBusyId(null);
    }
  }

  const queue = cases.filter(
    (claim) => !["RESOLVED", "CLOSED"].includes(claim.status),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Healthcare operations"
        title="Claims command center"
        description={`${profile?.full_name ?? "Reviewer"}, you see every case assigned to your organization — trigger the agent, review gaps, and approve appeal drafts.`}
        action={
          <button
            type="button"
            onClick={() => void seedDemo()}
            className="cs-btn cs-btn-ghost"
          >
            Load demo cases
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Org cases" value={stats.incoming} icon={Inbox} />
        <StatCard
          label="Needs review"
          value={stats.action}
          icon={AlertTriangle}
        />
        <StatCard
          label="Agent running"
          value={stats.analyzing}
          icon={Activity}
        />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Action queue</h2>
        {queue.length === 0 ? (
          <EmptyState
            title="Queue is clear"
            description="Load the demo set after a patient account exists, or wait for incoming claims."
          />
        ) : (
          <div className="grid gap-3">
            {queue.map((claim) => (
              <div
                key={claim.id}
                className="grid gap-3 rounded-3xl border border-border bg-surface/80 p-3 lg:grid-cols-[1fr_auto]"
              >
                <CaseCard
                  claim={claim}
                  href={`/insurance/cases/${claim.id}`}
                  subtitle="Org-assigned claim"
                />
                <button
                  type="button"
                  disabled={busyId === claim.id}
                  onClick={() => void trigger(claim.id)}
                  className="cs-btn cs-btn-primary"
                >
                  <Bot size={16} />
                  {busyId === claim.id ? "Queuing…" : "Trigger AI agent"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
