"use client";

import { useEffect, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { appFetch, appUpload } from "@/lib/api";
import type {
  Organization,
  PrescriptionParse,
  PrescriptionUploadResult,
} from "@/lib/types";

export function PrescriptionUploadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<PrescriptionUploadResult | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [insurerOrgId, setInsurerOrgId] = useState("");
  const [draft, setDraft] = useState<PrescriptionParse | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void appFetch<{ organizations: Organization[] }>(
      "/api/workspace/organizations",
    )
      .then((data) => setOrganizations(data.organizations ?? []))
      .catch(() => setOrganizations([]));
  }, [open]);

  function reset() {
    setFile(null);
    setParsed(null);
    setDraft(null);
    setError(null);
    setBusy(false);
    setCreating(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a prescription file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await appUpload<PrescriptionUploadResult>(
        "/api/workspace/prescriptions",
        form,
      );
      setParsed(result);
      setDraft({
        ...result.parse,
        disease: result.parse.disease || "",
        service_type: result.parse.service_type || "",
        claim_purpose: result.parse.claim_purpose || "",
        medications: result.parse.medications ?? [],
        summary: result.parse.summary || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file");
    } finally {
      setBusy(false);
    }
  }

  async function createClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!draft?.service_type.trim()) {
      setError("Confirm the service you want to claim.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await appFetch<{
        sheets_error?: string | null;
        calendar_error?: string | null;
      }>("/api/workspace/cases", {
        method: "POST",
        body: JSON.stringify({
          service_type: draft.service_type.trim(),
          service_code: draft.service_code,
          insurer_org_id: insurerOrgId,
          disease: draft.disease.trim(),
          claim_purpose: draft.claim_purpose.trim(),
          drive_file_id: parsed?.drive?.drive_file_id,
          drive_url: parsed?.drive?.drive_url,
          document_name: parsed?.filename,
        }),
      });
      await onCreated();
      if (created.sheets_error) {
        throw new Error(`Claim saved, but Sheets sync failed: ${created.sheets_error}`);
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create claim");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color:var(--cs-overlay)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prescription-modal-title"
        className="cs-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Before you create a claim
            </p>
            <h2
              id="prescription-modal-title"
              className="mt-1 text-xl font-semibold"
            >
              Upload the doctor’s prescription
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              We extract the condition and the service to claim, store the file
              in Google Drive under patients / your name, then let you confirm
              the details.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!draft ? (
          <form onSubmit={(event) => void analyze(event)} className="mt-5 grid gap-4">
            <label className="grid cursor-pointer place-items-center rounded-2xl border border-dashed border-border bg-surface-2/60 px-4 py-10 text-center">
              <FileUp className="text-accent" size={22} />
              <span className="mt-3 text-sm font-medium">
                {file ? file.name : "Choose a JPEG, PNG, or PDF"}
              </span>
              <span className="mt-1 text-xs text-muted">
                Photos and scans are read with vision, then sent through RAG.
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="sr-only"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <button
              type="submit"
              disabled={busy || !file}
              className="cs-btn cs-btn-primary"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Reading prescription…
                </>
              ) : (
                "Parse prescription"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void createClaim(event)} className="mt-5 grid gap-3">
            {parsed?.drive ? (
              <p className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
                Saved to Drive · {parsed.drive.folder}
              </p>
            ) : parsed?.drive_error ? (
              <p className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                Parsed, but Drive upload failed: {parsed.drive_error}
              </p>
            ) : null}

            <label className="block text-sm font-medium">
              Health provider
              <select
                value={insurerOrgId}
                onChange={(event) => setInsurerOrgId(event.target.value)}
                className="cs-input mt-1.5"
              >
                <option value="">
                  {organizations.length
                    ? "Select a health provider"
                    : "Default provider (first available)"}
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Disease / diagnosis
              <input
                required
                value={draft.disease}
                onChange={(event) =>
                  setDraft({ ...draft, disease: event.target.value })
                }
                className="cs-input mt-1.5"
              />
            </label>

            <label className="block text-sm font-medium">
              Service to claim
              <input
                required
                value={draft.service_type}
                onChange={(event) =>
                  setDraft({ ...draft, service_type: event.target.value })
                }
                className="cs-input mt-1.5"
              />
            </label>

            <label className="block text-sm font-medium">
              Why you need coverage
              <textarea
                required
                value={draft.claim_purpose}
                onChange={(event) =>
                  setDraft({ ...draft, claim_purpose: event.target.value })
                }
                rows={3}
                className="cs-input mt-1.5 min-h-[5.5rem] rounded-2xl"
              />
            </label>

            {draft.medications.length ? (
              <p className="text-sm text-muted">
                Medications: {draft.medications.join(", ")}
              </p>
            ) : null}

            {parsed?.extracted_text ? (
              <details className="rounded-2xl border border-border bg-surface-2/70 p-3 text-sm">
                <summary className="cursor-pointer font-medium">
                  Extracted prescription text
                </summary>
                <p className="mt-2 whitespace-pre-wrap leading-6 text-muted">
                  {parsed.extracted_text}
                </p>
              </details>
            ) : null}

            {parsed?.rag?.matched_clauses?.length ? (
              <div className="rounded-2xl border border-border bg-surface-2/70 p-3 text-sm">
                <p className="font-medium">Related policy clauses</p>
                <ul className="mt-2 space-y-2 text-muted">
                  {parsed.rag.matched_clauses.slice(0, 3).map((clause) => (
                    <li key={clause.citation ?? clause.clause_title}>
                      <span className="text-accent">
                        {clause.citation ?? clause.clause_title}
                      </span>
                      {clause.text ? ` — ${clause.text.slice(0, 160)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="cs-btn cs-btn-ghost"
              >
                Use another file
              </button>
              <button
                type="submit"
                disabled={creating}
                className="cs-btn cs-btn-primary"
              >
                {creating ? "Creating claim…" : "Confirm and create claim"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
