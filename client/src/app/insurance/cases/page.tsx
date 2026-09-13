"use client";

import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useCases } from "@/lib/use-workspace-data";

export default function InsuranceCasesPage() {
  const { cases, error } = useCases();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Healthcare"
        title="Case queue"
        description="Every claim assigned to your organization, including resolved and closed."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {cases.length === 0 ? (
        <EmptyState
          title="No org cases"
          description="Load demo cases from Operations after a patient account exists."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cases.map((claim) => (
            <CaseCard
              key={claim.id}
              claim={claim}
              href={`/insurance/cases/${claim.id}`}
              subtitle="Org-assigned claim"
            />
          ))}
        </div>
      )}
    </div>
  );
}
