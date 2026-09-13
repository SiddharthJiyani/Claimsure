import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
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
          <div className="flex shrink-0 items-center gap-3">
            {doc.is_missing ? (
              <span className="inline-flex items-center gap-1 text-xs text-warn">
                <AlertTriangle size={14} /> Missing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle2 size={14} /> Found
              </span>
            )}
            {!doc.is_missing && doc.drive_url ? (
              <a
                href={doc.drive_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-foreground"
              >
                View file <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
