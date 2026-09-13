"use client";

import { useState } from "react";
import { FileText, RotateCcw } from "lucide-react";
import { appUpload } from "@/lib/api";
import type { DocumentRecord } from "@/lib/types";

export function DocumentList({
  documents,
  caseId,
  onChanged,
  allowReplace = false,
}: {
  documents: DocumentRecord[];
  caseId?: string;
  onChanged?: () => void;
  allowReplace?: boolean;
}) {
  const uploaded = documents.filter((doc) => !doc.is_missing);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (uploaded.length === 0) {
    return <p className="text-sm text-muted">No files uploaded yet.</p>;
  }

  async function replace(doc: DocumentRecord, file: File | undefined) {
    if (!file || !caseId) return;
    setBusyId(doc.id);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", doc.name);
      form.set("document_type", doc.document_type);
      form.set("replace_document_id", doc.id);
      await appUpload(`/api/workspace/cases/${caseId}/documents`, form);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not replace file");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="space-y-2">
        {uploaded.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2"
          >
            <FileText size={16} className="text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <p className="text-xs text-muted">
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
            {allowReplace && caseId ? (
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-accent">
                <RotateCcw size={13} />
                {busyId === doc.id ? "Replacing…" : "Re-upload"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  disabled={busyId === doc.id}
                  onChange={(event) => {
                    void replace(doc, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
