"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { CaseQueueTable } from "@/components/CaseQueueTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton, StatCard } from "@/components/StatCard";
import { InsurerPolicyManager } from "@/components/InsurerPolicyManager";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { dayGreeting, displayName } from "@/lib/format";
import { useCases } from "@/lib/use-workspace-data";

const STEPS = [
  {
    title: "Queue",
    copy: "Inbound denials from patients in your organization.",
  },
  {
    title: "Analyze",
    copy: "Retrieve policy language and compute evidence gaps.",
  },
  {
    title: "Decide",
    copy: "Approve, reject, or escalate the citation-backed draft.",
  },
];

export default function InsuranceDashboardPage() {
  const { profile, user } = useAuth();
  const { cases, error, loading, reload, setError } = useCases();
  const [busyId, setBusyId] = useState<string | null>(null);
  const firstName = displayName({
    fullName: profile?.full_name,
    email: profile?.email ?? user?.email,
  }).split(" ")[0];

  const casesList = Array.isArray(cases) ? cases : [];
  const stats = useMemo(
    () => ({
      incoming: casesList.length,
      action: casesList.filter((claim) =>
        ["ACTION_REQUIRED", "AWAITING_REVIEW", "APPEAL_READY"].includes(
          claim?.status,
        ),
      ).length,
      analyzing: casesList.filter((claim) => claim?.status === "ANALYZING").length,
      resolved: casesList.filter((claim) => claim?.status === "RESOLVED").length,
    }),
    [casesList],
  );

  async function trigger(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/cases/${id}/process`, {
        method: "POST",
        headers: { "Idempotency-Key": `${id}:process_${Date.now()}` },
        body: JSON.stringify({}),
      });
      await reload();
      setTimeout(() => { void reload(); }, 2000);
      setTimeout(() => { void reload(); }, 4000);
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
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Healthcare operations"
        title={`${dayGreeting()}, ${firstName}`}
        description="Review org-assigned cases, run the denial agent, and approve citation-backed appeals. Patients never see this desk."
        action={
          <Link href="/insurance/cases" className="cs-btn cs-btn-ghost">
            Open full queue
          </Link>
        }
      />

      <div className="cs-panel grid gap-0 overflow-hidden rounded-2xl md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="border-t border-border px-5 py-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"
          >
            <p className="font-mono text-[11px] text-accent">
              {String(index + 1).padStart(2, "0")}
            </p>
            <p className="mt-2 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{step.copy}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Org cases" value={stats.incoming} icon={Inbox} />
        <StatCard
          label="Needs review"
          value={stats.action}
          hint="Ready for a human decision"
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
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Review queue</h2>
            <p className="mt-1 text-sm text-muted">
              Open cases only. Resolved work lives in the full queue.
            </p>
          </div>
          <p className="text-xs text-muted">{queue.length} open</p>
        </div>
        {loading ? (
          <QueueSkeleton />
        ) : queue.length === 0 ? (
          <EmptyState
            title="No open cases"
            description="This desk stays empty until a patient in your organization submits a denied or pending service."
            hints={[
              "Inbound claims land in this queue automatically.",
              "Run the agent to retrieve policy and evidence gaps.",
              "Approve or escalate the appeal from the case page.",
            ]}
          />
        ) : (
          <CaseQueueTable
            cases={queue}
            hrefFor={(claim) => `/insurance/cases/${claim.id}`}
            action={(claim) => (
              <button
                type="button"
                disabled={busyId === claim.id}
                onClick={() => void trigger(claim.id)}
                className="cs-btn cs-btn-primary"
              >
                <Bot size={14} />
                {busyId === claim.id ? "Queuing…" : "Run agent"}
              </button>
            )}
          />
        )}
      </section>

      <section className="pt-4">
        <InsurerPolicyManager />
      </section>
    </WorkspaceFrame>
  );
}
