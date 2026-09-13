import React, { useState } from "react";
import type { AgentState } from "@/lib/types";
import {
  CheckCircle2,
  Clock,
  Code,
  ShieldCheck,
  Search,
  FileText,
  AlertCircle,
  Cpu,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const NODE_DEFINITIONS: Record<
  string,
  { label: string; stage: number; description: string; icon: React.ElementType }
> = {
  parse_denial: {
    label: "Parse Denial",
    stage: 1,
    description: "Extracts diagnostic & CPT codes, denial reasons, and appeal deadlines.",
    icon: FileText,
  },
  retrieve_requirements: {
    label: "Retrieve Requirements (RAG)",
    stage: 2,
    description: "Vector similarity search against insurer clinical coverage policy corpus.",
    icon: Search,
  },
  scan_evidence: {
    label: "Scan Evidence",
    stage: 3,
    description: "Compares uploaded clinical records against policy requirements.",
    icon: ShieldCheck,
  },
  compute_gap: {
    label: "Compute Gap",
    stage: 4,
    description: "Calculates deterministic set-difference between policy and documented care.",
    icon: AlertCircle,
  },
  route: {
    label: "Safety Route Decision",
    stage: 5,
    description: "Deterministic guardrails: routes to human review or automated action.",
    icon: Cpu,
  },
  act: {
    label: "Multi-App Dispatch (MCP)",
    stage: 6,
    description: "Dispatches updates to Google Sheets, Calendar, and email via MCP tools.",
    icon: ExternalLink,
  },
  await_human: {
    label: "Clinician Safety Boundary",
    stage: 7,
    description: "Pauses workflow for licensed human reviewer to approve the appeal.",
    icon: Clock,
  },
  assemble_appeal: {
    label: "Assemble Appeal",
    stage: 8,
    description: "Drafts formal legal appeal citing verified policy clauses and evidence.",
    icon: FileText,
  },
  verify: {
    label: "Verify Citations",
    stage: 9,
    description: "Verifies letter citations and claims against ground-truth policy text.",
    icon: CheckCircle2,
  },
};

export function AgentTrace({ states }: { states: AgentState[] }) {
  const [showRaw, setShowRaw] = useState(false);

  if (states.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-6 text-center text-sm text-muted">
        The 9-node AI agent has not executed on this case yet. Click{" "}
        <span className="font-semibold text-foreground">"Trigger AI agent"</span>{" "}
        above to run the autonomous recovery pipeline.
      </div>
    );
  }

  // Use the most recent agent execution state
  const latestState = [...states].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];

  const stateData = (latestState?.state_data ?? {}) as Record<string, any>;
  const auditTrail: Array<{
    node: string;
    action?: string;
    summary?: string;
    timestamp?: string;
    confidence?: number;
  }> = Array.isArray(stateData.audit_trail)
    ? stateData.audit_trail
    : Array.isArray(stateData.node_trace)
      ? stateData.node_trace
      : [];

  const actionsTaken: string[] = Array.isArray(stateData.actions_taken)
    ? stateData.actions_taken
    : Array.isArray(stateData.actions_dispatched)
      ? stateData.actions_dispatched.map((a: any) => `${a.app}:${a.action_type}`)
      : [];

  return (
    <div className="space-y-4">
      {/* Execution Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Cpu size={15} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Pipeline Status
            </p>
            <p className="text-sm font-medium text-foreground">
              Final Node:{" "}
              <span className="font-mono text-accent">
                {latestState.current_node || stateData.final_node || "completed"}
              </span>
              {stateData.confidence !== undefined ? (
                <span className="text-xs text-muted ml-2">
                  (Confidence: {Math.round(stateData.confidence * 100)}%)
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRaw(!showRaw)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
        >
          <Code size={13} />
          {showRaw ? "Hide Raw State" : "Inspect State Object"}
          {showRaw ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {/* 9-Node Execution Timeline */}
      {auditTrail.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            State Machine Trace ({auditTrail.length} Nodes Executed)
          </p>
          <div className="space-y-2">
            {auditTrail.map((item, index) => {
              const def = NODE_DEFINITIONS[item.node];
              const Icon = def?.icon || CheckCircle2;
              const title = def?.label || item.node;
              const text = item.action || item.summary || def?.description;

              return (
                <div
                  key={`${item.node}-${index}`}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface-2/70 p-3 text-sm transition hover:bg-surface-2"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <p className="font-medium text-foreground">
                        {def?.stage ? `Node ${def.stage}: ` : ""}
                        {title}
                      </p>
                      {item.timestamp ? (
                        <span className="font-mono text-[10px] text-muted">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      ) : null}
                    </div>
                    {text ? (
                      <p className="mt-1 text-xs text-muted leading-relaxed">
                        {text}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Actions Dispatched via MCP */}
      {actionsTaken.length > 0 ? (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3.5 text-xs">
          <p className="font-semibold text-violet-300">
            Dispatched via Model Context Protocol (MCP):
          </p>
          <ul className="mt-2 space-y-1 font-mono text-violet-200/90">
            {actionsTaken.map((action, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Raw State JSON Accordion */}
      {showRaw ? (
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Raw Agent State Dump
          </p>
          <pre className="cs-code mt-2 max-h-72 overflow-x-auto rounded-lg p-3 text-xs text-muted">
            {JSON.stringify(stateData, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
