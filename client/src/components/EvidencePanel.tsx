import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import {
  normalizeEvidenceLabel,
  uniqueDocumentsByName,
} from "@/lib/missing-evidence";
import type { DocumentRecord } from "@/lib/types";

export function EvidencePanel({
  documents,
  extraMissing = [],
}: {
  documents: DocumentRecord[];
  extraMissing?: string[];
}) {
  const uniqueDocs = uniqueDocumentsByName(documents);
  const tracked = new Set(
    uniqueDocs.map((doc) => normalizeEvidenceLabel(doc.name)),
  );
  const extras = extraMissing.filter(
    (label) => !tracked.has(normalizeEvidenceLabel(label)),
  );

  if (uniqueDocs.length === 0 && extras.length === 0) {
    return (
      <p className="text-sm text-muted">No evidence has been attached yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {extras.map((label) => (
        <li
          key={`missing:${label}`}
          className="flex items-start justify-between gap-3 rounded-xl border border-warn/40 bg-warn/8 px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted">Requested by coverage review</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-warn">
            <AlertTriangle size={14} /> Missing
          </span>
        </li>
      ))}
      {uniqueDocs.map((doc) => (
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
