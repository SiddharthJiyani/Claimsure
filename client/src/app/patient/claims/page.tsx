"use client";

import { FolderOpen } from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientClaimsPage() {
  const { cases, error, loading, reload } = useCases();

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Patient"
        title="My claims"
        description="Every personal case, with status and missing-evidence flags."
      />
      {error ? (
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}
      {loading ? (
        <QueueSkeleton rows={4} />
      ) : cases.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No claims yet"
          description="Submit a denied or pending service from Overview. This list stays empty until you do."
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
    </WorkspaceFrame>
  );
}
