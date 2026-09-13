"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { StatCard } from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ClaimCase } from "@/lib/types";

export default function InsuranceDashboardPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<ClaimCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<{ cases: ClaimCase[] }>("/cases");
      setCases(data.cases);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load operations queue",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      await load();
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
      await load();
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-accent-2">Healthcare operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Claims queue
          </h1>
          <p className="mt-2 text-sm text-muted">
            {profile?.full_name}, you see every case assigned to your
            organization — trigger the agent, review gaps, and approve appeal
            drafts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void seedDemo()}
          className="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Load demo cases
        </button>
      </div>

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
        <h2 className="text-lg font-semibold">Action queue</h2>
        {queue.length === 0 ? (
          <div className="mt-3 rounded-3xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted">
            No open organization cases. Load the demo set after a patient
            account exists, or wait for incoming claims.
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {queue.map((claim) => (
              <div
                key={claim.id}
                className="grid gap-3 rounded-3xl border border-border bg-surface p-3 lg:grid-cols-[1fr_auto]"
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
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
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
