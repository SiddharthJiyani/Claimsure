"use client";

import { EvidencePanel } from "@/components/EvidencePanel";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientDocumentsPage() {
  const { cases, error } = useCases();
  const withDocs = cases.filter((claim) => (claim.documents?.length ?? 0) > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Patient"
        title="Documents"
        description="Evidence attached to your claims. Missing items are what the agent still needs."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {withDocs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Open a claim and upload the missing clinical note from the case page."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {withDocs.map((claim) => (
            <section key={claim.id} className="cs-panel rounded-3xl p-5">
              <p className="font-mono text-xs text-muted">
                {claim.case_number}
              </p>
              <h2 className="mt-1 font-semibold">{claim.service_type}</h2>
              <div className="mt-4">
                <EvidencePanel documents={claim.documents ?? []} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
