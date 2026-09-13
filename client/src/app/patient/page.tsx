"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, FolderOpen } from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { PrescriptionUploadModal } from "@/components/PrescriptionUploadModal";
import { QueueSkeleton, StatCard } from "@/components/StatCard";
import { useAuth } from "@/lib/auth-context";
import { dayGreeting, displayName } from "@/lib/format";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientDashboardPage() {
  const { profile, user } = useAuth();
  const { cases, error, loading, reload } = useCases();
  const [modalOpen, setModalOpen] = useState(false);
  const firstName = displayName({
    fullName: profile?.full_name,
    email: profile?.email ?? user?.email,
  }).split(" ")[0];

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

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Patient workspace"
        title={`${dayGreeting()}, ${firstName}`}
        description="Track prior-authorization and denial cases, upload missing clinical evidence, and follow appeal status. Only your claims appear here."
      />

      <div className="cs-panel grid gap-0 overflow-hidden rounded-2xl md:grid-cols-3">
        {[
          [
            "01",
            "Submit the denied service",
            "Start from the denial or pending prior-auth request.",
          ],
          [
            "02",
            "Upload missing records",
            "Clinical notes and orders the payer still needs.",
          ],
          [
            "03",
            "Watch status move",
            "Action required, appeal, or resolved — in one timeline.",
          ],
        ].map(([step, title, copy]) => (
          <div
            key={step}
            className="border-t border-border px-5 py-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0"
          >
            <p className="font-mono text-[11px] text-accent">{step}</p>
            <p className="mt-2 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{copy}</p>
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
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}

      <section className="cs-panel rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-accent/12 p-2 text-accent">
            <FileUp size={18} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              Submit a denied or pending service
            </h2>
            <p className="mt-1 text-sm text-muted">
              Upload the doctor’s prescription first. We parse the diagnosis
              and the service to claim, save the file to Drive, then you
              confirm before the claim is created.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="cs-btn cs-btn-primary mt-4"
            >
              Upload prescription
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your claims</h2>
        {loading ? (
          <QueueSkeleton />
        ) : cases.length === 0 ? (
          <EmptyState
            title="No claims yet"
            description="When a payer denies or delays a service, create the claim above. Nothing is preloaded."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cases.map((claim) => (
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

      <PrescriptionUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => reload()}
      />
    </WorkspaceFrame>
  );
}
