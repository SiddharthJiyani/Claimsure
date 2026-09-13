"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, FolderOpen } from "lucide-react";
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
      open: cases.filter((claim) => !["RESOLVED", "CLOSED"].includes(claim.status)).length,
      action: cases.filter((claim) => claim.status === "ACTION_REQUIRED").length,
      resolved: cases.filter((claim) => claim.status === "RESOLVED").length,
    }),
    [cases],
  );

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
        title={`Denial recovery${profile?.full_name ? ` · ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Track your prior-authorization and denial cases, upload missing clinical evidence, and follow appeal status. Only your claims appear here."
      />

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["1", "Submit the denied service", "Start from the denial or pending prior-auth request."],
          ["2", "Upload missing records", "Clinical notes and orders the payer still needs."],
          ["3", "Watch status move", "Action required, appeal, or resolved — in one timeline."],
        ].map(([step, title, copy]) => (
          <div key={step} className="cs-panel rounded-2xl p-4">
            <p className="font-mono text-xs text-accent">{step}</p>
            <p className="mt-2 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{copy}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Open claims" value={stats.open} icon={FolderOpen} />
        <StatCard
          label="Needs your action"
          value={stats.action}
          hint="Missing clinical documentation"
          icon={AlertTriangle}
        />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} />
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <section className="cs-panel rounded-3xl p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-accent/12 p-2 text-accent">
            <FileUp size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Submit a denied or pending service</h2>
            <p className="mt-1 text-sm text-muted">
              Enter the service name from the denial letter. You can attach evidence after the claim is created.
            </p>
            <form onSubmit={createCase} className="mt-4 flex flex-col gap-3 md:flex-row">
              <input
                required
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
                placeholder="Service on the denial, e.g. MRI lumbar spine"
                className="cs-input flex-1"
              />
              <button type="submit" disabled={busy} className="cs-btn cs-btn-primary">
                {busy ? "Submitting…" : "Create claim"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your claims</h2>
        {cases.length === 0 ? (
          <EmptyState
            title="No claims yet"
            description="When a payer denies or delays a service, create the claim above. Nothing is preloaded."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cases.map((claim) => (
              <CaseCard key={claim.id} claim={claim} href={`/patient/cases/${claim.id}`} subtitle="Your claim" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
