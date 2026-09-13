import type { AuditLog } from "@/lib/types";

export function CaseTimeline({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted">No audit events yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {logs.map((log) => (
        <li key={log.id} className="relative pl-6">
          <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {log.action.replaceAll("_", " ")}
              </p>
              <p className="text-xs text-muted">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">
              {log.actor_type}
              {log.node ? ` · ${log.node}` : ""}
              {log.previous_state && log.new_state
                ? ` · ${log.previous_state} → ${log.new_state}`
                : ""}
            </p>
            {log.ai_recommendation ? (
              <p className="mt-2 text-sm text-foreground/80">
                {log.ai_recommendation}
              </p>
            ) : null}
            {log.human_decision ? (
              <p className="mt-2 text-sm text-accent">
                Decision: {log.human_decision}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
