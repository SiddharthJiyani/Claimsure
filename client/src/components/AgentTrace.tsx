import type { AgentState } from "@/lib/types";

export function AgentTrace({ states }: { states: AgentState[] }) {
  if (states.length === 0) {
    return (
      <p className="text-sm text-muted">
        The agent has not run on this case yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {states.map((state) => (
        <details
          key={state.id}
          className="rounded-xl border border-border bg-surface-2 px-3 py-2"
          open
        >
          <summary className="cursor-pointer text-sm font-medium">
            Node: {state.current_node}
            {state.is_dry_run ? " · dry run" : ""}
          </summary>
          <pre className="cs-code mt-3 overflow-x-auto rounded-lg p-3 text-xs text-muted">
            {JSON.stringify(state.state_data, null, 2)}
          </pre>
        </details>
      ))}
    </div>
  );
}
