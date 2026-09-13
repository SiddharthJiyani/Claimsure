"use client";

import { useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { appUpload } from "@/lib/api";
import {
  inferDocumentType,
  normalizeEvidenceLabel,
  uniqueMissingDocuments,
} from "@/lib/missing-evidence";
import type { DocumentRecord } from "@/lib/types";

type MissingItem = {
  id: string;
  name: string;
  document_type: string;
  replaceId?: string;
};

export function MissingDocumentsPanel({
  caseId,
  documents,
  requestedLabels = [],
  onUploaded,
}: {
  caseId: string;
  documents: DocumentRecord[];
  requestedLabels?: string[];
  onUploaded: () => void;
}) {
  const fromDocs: MissingItem[] = uniqueMissingDocuments(documents).map((doc) => ({
    id: doc.id,
    name: doc.name,
    document_type: doc.document_type,
    replaceId: doc.id,
  }));

  const tracked = new Set(
    fromDocs.map((item) => normalizeEvidenceLabel(item.name)),
  );
  const uploaded = new Set(
    documents
      .filter((doc) => !doc.is_missing)
      .map((doc) => normalizeEvidenceLabel(doc.name)),
  );
  const fromLabels: MissingItem[] = requestedLabels
    .filter((label) => !tracked.has(normalizeEvidenceLabel(label)))
    .filter((label) => !uploaded.has(normalizeEvidenceLabel(label)))
    .map((label) => ({
      id: `label:${label}`,
      name: label,
      document_type: inferDocumentType(label),
    }));

  const missing = [...fromDocs, ...fromLabels];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (missing.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing is waiting on you right now. If healthcare needs another
        record, it will appear here and in your alerts.
      </p>
    );
  }

  async function uploadFor(item: MissingItem, file: File | undefined) {
    if (!file) return;
    setBusyId(item.id);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", item.name);
      form.set("document_type", item.document_type);
      if (item.replaceId) form.set("replace_document_id", item.replaceId);
      await appUpload(`/api/workspace/cases/${caseId}/documents`, form);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-muted">
        These are the same records healthcare marked missing. Upload each
        file here so the packet can be reviewed again.
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="space-y-2">
        {missing.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-warn/40 bg-warn/8 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-start gap-1.5 text-sm font-semibold">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.document_type.replaceAll("_", " ")} · still needed
                </p>
              </div>
              <label className="cs-btn cs-btn-primary cursor-pointer text-xs">
                <Upload size={14} />
                {busyId === item.id ? "Uploading…" : "Upload file"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  disabled={busyId === item.id}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void uploadFor(item, file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
