"use client";

import { Files } from "lucide-react";
import { EvidencePanel } from "@/components/EvidencePanel";
import { EmptyState } from "@/components/EmptyState";
import { ErrorCallout } from "@/components/ErrorCallout";
import { PageHeader, WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientDocumentsPage() {
  const { cases, error, loading, reload } = useCases();
  const withDocs = cases.filter((claim) => (claim.documents?.length ?? 0) > 0);

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Patient"
        title="Documents"
        description="Evidence attached to your claims. Missing items are what the agent still needs."
      />
      {error ? (
        <ErrorCallout message={error} onRetry={() => void reload()} />
      ) : null}
      {loading ? (
        <QueueSkeleton />
      ) : withDocs.length === 0 ? (
        <EmptyState
          icon={Files}
          title="No documents yet"
          description="Open a claim and upload the missing clinical note from the case page."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {withDocs.map((claim) => (
            <section key={claim.id} className="cs-panel rounded-2xl p-5">
              <p className="font-mono text-xs text-muted">{claim.case_number}</p>
              <h2 className="mt-1 font-semibold">{claim.service_type}</h2>
              <div className="mt-4">
                <EvidencePanel documents={claim.documents ?? []} />
              </div>
            </section>
          ))}
        </div>
      )}
    </WorkspaceFrame>
  );
}
