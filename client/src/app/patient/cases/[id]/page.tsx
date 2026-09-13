"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CaseTimeline } from "@/components/CaseTimeline";
import { DocumentList } from "@/components/DocumentList";
import { ErrorCallout } from "@/components/ErrorCallout";
import { EvidencePanel } from "@/components/EvidencePanel";
import { PatientAppealPanel } from "@/components/PatientAppealPanel";
import { WorkspaceFrame } from "@/components/PageHeader";
import { QueueSkeleton } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { appFetch } from "@/lib/api";
import type { ClaimCase } from "@/lib/types";

export default function PatientCasePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimCase | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function load() {
    try {
      const data = await appFetch<{ case: ClaimCase }>(
        `/api/workspace/cases/${params.id}`,
      );
      setClaim(data.case);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load case");
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!claim) return;
    setBusy(true);
    try {
      await appFetch(`/api/workspace/cases/${claim.id}/documents`, {
        method: "POST",
        body: JSON.stringify({
          name: fileName,
          document_type: "clinical_note",
        }),
      });
      setFileName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeClaim() {
    if (!claim) return;
    const confirmed = window.confirm(
      `Remove claim ${claim.case_number}? Healthcare will stop reviewing it.`,
    );
    if (!confirmed) return;
    setRemoving(true);
    setError(null);
    try {
      await appFetch(`/api/workspace/cases/${claim.id}`, { method: "DELETE" });
      router.push("/patient/claims");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove claim");
    } finally {
      setRemoving(false);
    }
  }

  if (!claim) {
    return (
      <WorkspaceFrame>
        {error ? (
          <ErrorCallout message={error} onRetry={() => void load()} />
        ) : (
          <QueueSkeleton rows={5} />
        )}
      </WorkspaceFrame>
    );
  }

  const denial = claim.denials?.[0];
  const logs = [...(claim.audit_logs ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <WorkspaceFrame>
      <Link
        href="/patient/claims"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Back to claims
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight">
            {claim.service_type}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {claim.service_code ?? "Service code pending"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={claim.status} />
          {claim.status !== "RESOLVED" && claim.status !== "CLOSED" ? (
            <button
              type="button"
              disabled={removing}
              onClick={() => void removeClaim()}
              className="cs-btn cs-btn-ghost text-danger"
            >
              {removing ? "Removing…" : "Remove claim"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorCallout message={error} onRetry={() => void load()} />
      ) : null}

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">What happened</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {denial?.denial_reason ??
            "This claim is awaiting payer review. When a denial arrives, Claimsure will explain it here in plain language."}
        </p>
        {denial?.appeal_deadline ? (
          <p className="mt-3 text-sm text-warn">
            Appeal deadline: {denial.appeal_deadline}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="cs-panel rounded-2xl p-5">
          <p className="cs-kicker">Evidence checklist</p>
          <div className="mt-4">
            <EvidencePanel documents={claim.documents ?? []} />
          </div>
        </section>
        <section className="cs-panel rounded-2xl p-5">
          <p className="cs-kicker">Upload a missing record</p>
          <p className="mt-3 text-sm text-muted">
            Files are stored as metadata for now. Uploading a missing note moves
            the case back to analysis.
          </p>
          <form onSubmit={upload} className="mt-4 space-y-3">
            <input
              required
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="Clinical note — Dr. Patel 2026-08-02"
              className="cs-input"
            />
            <button
              type="submit"
              disabled={busy}
              className="cs-btn cs-btn-primary"
            >
              {busy ? "Uploading…" : "Mark document uploaded"}
            </button>
          </form>
          <div className="mt-5">
            <DocumentList documents={claim.documents ?? []} />
          </div>
        </section>
      </div>

      <PatientAppealPanel
        claim={claim}
        onChanged={() => void load()}
      />

      <section className="cs-panel rounded-2xl p-5">
        <p className="cs-kicker">Status timeline</p>
        <div className="mt-4">
          <CaseTimeline logs={logs} />
        </div>
      </section>
    </WorkspaceFrame>
  );
}
