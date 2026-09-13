import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DocumentRecord } from "@/lib/types";

export function EvidencePanel({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted">No evidence has been attached yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">{doc.name}</p>
            <p className="text-xs text-muted">
              {doc.document_type.replaceAll("_", " ")}
            </p>
          </div>
          {doc.is_missing ? (
            <span className="inline-flex items-center gap-1 text-xs text-warn">
              <AlertTriangle size={14} /> Missing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <CheckCircle2 size={14} /> Found
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
