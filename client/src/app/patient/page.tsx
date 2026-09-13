"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen } from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientDashboardPage() {
  const { profile } = useAuth();
  const { cases, error, reload, setError } = useCases();
  const [serviceType, setServiceType] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(
    () => ({
      open: cases.filter(
        (claim) => !["RESOLVED", "CLOSED"].includes(claim.status),
      ).length,
      action: cases.filter((claim) => claim.status === "ACTION_REQUIRED")
        .length,
      resolved: cases.filter((claim) => claim.status === "RESOLVED").length,
    }),
    [cases],
  );

  async function seedDemo() {
    setBusy(true);
    try {
      await apiFetch("/demo/seed", { method: "POST" });
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load demo cases",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/cases", {
        method: "POST",
        body: JSON.stringify({ service_type: serviceType }),
      });
      setServiceType("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit claim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Patient workspace"
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Your claims, missing documents, and status updates. Healthcare staff see the same case with agent tools you do not."
        action={
          <button
            type="button"
            onClick={() => void seedDemo()}
            disabled={busy}
            className="cs-btn cs-btn-ghost"
          >
            Load demo cases
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Open claims" value={stats.open} icon={FolderOpen} />
        <StatCard
          label="Needs your action"
          value={stats.action}
          hint="Usually a missing clinical record"
          icon={AlertTriangle}
        />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="cs-panel rounded-3xl p-6">
        <h2 className="text-lg font-semibold">Start a claim</h2>
        <p className="mt-1 text-sm text-muted">
          Describe the denied or pending service. Attach evidence on the case
          page.
        </p>
        <form
          onSubmit={createCase}
          className="mt-4 flex flex-col gap-3 md:flex-row"
        >
          <input
            required
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            placeholder="e.g. MRI Lumbar Spine"
            className="cs-input flex-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="cs-btn cs-btn-primary"
          >
            Submit claim
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent claims</h2>
        {cases.length === 0 ? (
          <EmptyState
            title="No claims yet"
            description="Submit one above or load the demo set to explore the full flow."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cases.slice(0, 4).map((claim) => (
              <CaseCard
                key={claim.id}
                claim={claim}
                href={`/patient/cases/${claim.id}`}
                subtitle="Your claim"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
