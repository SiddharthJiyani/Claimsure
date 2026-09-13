import { FileText } from "lucide-react";
import type { DocumentRecord } from "@/lib/types";

export function DocumentList({ documents }: { documents: DocumentRecord[] }) {
  const uploaded = documents.filter((doc) => !doc.is_missing);
  if (uploaded.length === 0) {
    return <p className="text-sm text-muted">No files uploaded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {uploaded.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2"
        >
          <FileText size={16} className="text-accent" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            <p className="text-xs text-muted">
              {new Date(doc.created_at).toLocaleDateString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
