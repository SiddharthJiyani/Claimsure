"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CaseTimeline } from "@/components/CaseTimeline";
import { DocumentList } from "@/components/DocumentList";
import { EvidencePanel } from "@/components/EvidencePanel";
import { StatusBadge } from "@/components/StatusBadge";
import { apiFetch } from "@/lib/api";
import type { ClaimCase } from "@/lib/types";

export default function PatientCasePage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimCase | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ case: ClaimCase }>(`/cases/${params.id}`);
      setClaim(data.case);
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
      await apiFetch("/documents", {
        method: "POST",
        body: JSON.stringify({
          case_id: claim.id,
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

  if (!claim) {
    return <p className="text-sm text-muted">{error ?? "Loading case…"}</p>;
  }

  const denial = claim.denials?.[0];
  const logs = [...(claim.audit_logs ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted">{claim.case_number}</p>
          <h1 className="mt-1 text-3xl font-semibold">{claim.service_type}</h1>
          <p className="mt-1 text-sm text-muted">
            {claim.service_code ?? "Service code pending"}
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="cs-panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold">What happened</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
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
        <section className="cs-panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Evidence checklist</h2>
          <div className="mt-4">
            <EvidencePanel documents={claim.documents ?? []} />
          </div>
        </section>
        <section className="cs-panel rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Upload a missing record</h2>
          <p className="mt-1 text-sm text-muted">
            Files are stored as metadata for now (Drive comes next). Uploading a
            missing note moves the case back to analysis.
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

      <section className="cs-panel rounded-3xl p-5">
        <h2 className="text-lg font-semibold">Status timeline</h2>
        <div className="mt-4">
          <CaseTimeline logs={logs} />
        </div>
      </section>
    </div>
  );
}
