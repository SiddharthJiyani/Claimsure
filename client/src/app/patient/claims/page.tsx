"use client";

import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useCases } from "@/lib/use-workspace-data";

export default function PatientClaimsPage() {
  const { cases, error } = useCases();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Patient"
        title="My claims"
        description="Every personal case, with status and missing-evidence flags."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {cases.length === 0 ? (
        <EmptyState
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
    </div>
  );
}
