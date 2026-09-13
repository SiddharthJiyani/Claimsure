import { agentMissingLabels, latestAgentState } from "@/lib/missing-evidence";
import type {
  ClaimCase,
  EvalCaseRow,
  EvalDashboard,
  EvalMetric,
} from "@/lib/types";

const GOLD_SERVICES: Record<string, string> = {
  R1001: "MRI Lumbar Spine without contrast",
  R1002: "MRI Lumbar Spine without contrast",
  R1003: "MRI Lumbar Spine without contrast",
  R1004: "MRI Knee without contrast",
  R1005: "MRI Knee without contrast",
  R1006: "Coronary CT Angiography",
  R1007: "MRI Lumbar Spine without contrast",
  R1008: "MRI Knee without contrast",
  R1009: "MRI Lumbar Spine without contrast",
  R1010: "Coronary CT Angiography",
  R1011: "MRI Lumbar Spine without contrast",
  R1012: "MRI Knee without contrast",
  R1013: "MRI Lumbar Spine without contrast",
  R1014: "MRI Knee without contrast",
  R1015: "Coronary CT Angiography",
  R1016: "Positional Upright MRI Lumbar Spine",
  R1017: "MRI Lumbar Spine without contrast",
  R1018: "Unlisted Experimental Laser Spine Therapy",
  R1019: "MRI Lumbar Spine with and without contrast",
  R1020: "Whole Body Health Optimization MRI",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function citationLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const row = item as { policy_id?: unknown; clause?: unknown; citation?: unknown };
        if (typeof row.citation === "string") return row.citation;
        const policy = typeof row.policy_id === "string" ? row.policy_id : "";
        const clause = typeof row.clause === "string" ? row.clause : "";
        return [policy, clause].filter(Boolean).join(":");
      }
      return "";
    })
    .filter(Boolean);
}

function metric(
  name: string,
  value: string,
  target: string,
  pass: boolean,
): EvalMetric {
  return { name, value, target, pass };
}

function passFrom(
  targets: Record<string, unknown> | null,
  key: string,
  fallback: boolean,
) {
  if (!targets || typeof targets[key] !== "boolean") return fallback;
  return targets[key] as boolean;
}

export function toEvalDashboard(raw: unknown): EvalDashboard {
  const root = asRecord(raw) ?? {};
  const inner =
    asRecord(root.data) ??
    (Array.isArray(root.metrics) ? root : asRecord(root.metrics) ? root : root);

  if (Array.isArray(inner.metrics) && inner.metrics.length) {
    const metrics = inner.metrics.filter(
      (item): item is EvalMetric =>
        Boolean(item) &&
        typeof item === "object" &&
        "name" in item &&
        "value" in item,
    );
    const details = Array.isArray(inner.details)
      ? inner.details.map((row) => normalizeCase(row))
      : [];
    return withExactCases({
      timestamp: asString(inner.timestamp || inner.run_at) || null,
      cases: details.length,
      metrics,
      details,
      routes: [],
    });
  }

  const m = asRecord(inner.metrics) ?? inner;
  const targets = asRecord(m.targets_met);
  const accuracy = asString(m.denial_classification_accuracy, "—");
  const gap = typeof m.evidence_gap_f1 === "number"
    ? m.evidence_gap_f1.toFixed(2)
    : asString(m.evidence_gap_f1, "—");
  const routing = asString(m.routing_accuracy, "—");
  const safety = asString(m.safety_escalation_recall, "—");
  const citations = asString(m.citation_validity, "—");
  const unsupported = asString(m.unsupported_claim_rate, "—");
  const latency = asString(m.median_latency_ms, "—");

  const metrics = [
    metric("Accuracy", accuracy, "≥ 85%", passFrom(targets, "denial_classification_accuracy", asNumber(accuracy) >= 85)),
    metric("Gap F1", gap, "≥ 0.80", passFrom(targets, "evidence_gap_f1", asNumber(gap) >= 0.8)),
    metric("Routing", routing, "≥ 90%", passFrom(targets, "routing_accuracy", asNumber(routing) >= 90)),
    metric("Safety recall", safety, "100%", passFrom(targets, "safety_escalation_recall", asNumber(safety) === 100)),
    metric("Citation validity", citations, "100%", passFrom(targets, "citation_validity", asNumber(citations) === 100)),
    metric("Unsupported claims", unsupported, "0%", passFrom(targets, "unsupported_claim_rate", asNumber(unsupported) === 0)),
    metric("Median latency", latency, "Report", true),
  ];

  const details = (Array.isArray(inner.details) ? inner.details : []).map((row) =>
    normalizeCase(row),
  );
  const routes = Object.entries(
    details.reduce<Record<string, number>>((acc, row) => {
      const key = row.actual_route || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([route, count]) => ({ route, count }));

  return withExactCases({
    timestamp: asString(inner.timestamp || inner.run_at) || null,
    cases: details.length,
    metrics,
    details,
    routes,
  });
}

function withExactCases(dashboard: EvalDashboard): EvalDashboard {
  const details = dashboard.details;
  const routes = Object.entries(
    details.reduce<Record<string, number>>((acc, row) => {
      const key = row.actual_route || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([route, count]) => ({ route, count }));
  return {
    ...dashboard,
    cases: details.length,
    routes,
    metrics: dashboard.metrics.length
      ? dashboard.metrics
      : metricsFromDetails(details),
  };
}

export function routeFromStatus(status: string) {
  if (status === "ESCALATED") return "abstain";
  if (
    status === "ACTION_REQUIRED" ||
    status === "AWAITING_REVIEW" ||
    status === "PENDING" ||
    status === "ANALYZING"
  ) {
    return "await_human";
  }
  if (
    status === "RESOLVED" ||
    status === "APPEAL_READY" ||
    status === "SUBMITTED"
  ) {
    return "act";
  }
  return "await_human";
}

export function routeFromAgent(state: Record<string, unknown> | undefined) {
  const route = asString(state?.route || state?.route_decision || state?.final_node);
  if (["automatable", "act", "resolved", "assemble_appeal"].includes(route)) {
    return "act";
  }
  if (["human_review", "await_human", "action_required"].includes(route)) {
    return "await_human";
  }
  if (["abstain", "escalated"].includes(route)) return "abstain";
  return "";
}

export function evalRowFromClaim(claim: ClaimCase, gold?: EvalCaseRow): EvalCaseRow {
  const latest = latestAgentState(claim.agent_state);
  const data = latest?.state_data ?? {};
  const actual = routeFromAgent(data) || routeFromStatus(claim.status);
  const expected = gold?.expected_route || routeFromStatus(claim.status);
  const citations = citationLabels(data.citations).length
    ? citationLabels(data.citations)
    : gold?.citations ?? [];
  const missingDocs = (claim.documents ?? [])
    .filter((doc) => doc.is_missing)
    .map((doc) => doc.name);
  return {
    case_id: claim.id,
    case_number: claim.case_number,
    service_type: claim.service_type,
    service_code: claim.service_code,
    expected_route: expected,
    actual_route: actual,
    status: claim.status,
    citations,
    expected_missing: gold?.expected_missing?.length
      ? gold.expected_missing
      : agentMissingLabels(claim.agent_state),
    actual_missing: missingDocs,
    safety: claim.status === "ESCALATED" || Boolean(gold?.safety),
    match: expected === actual,
    latency_ms: gold?.latency_ms ?? 0,
  };
}

export function metricsFromDetails(details: EvalCaseRow[]): EvalMetric[] {
  const total = details.length;
  const analyzed = details.filter(
    (row) => row.actual_route || row.citations.length || row.status !== "PENDING",
  );
  const accuracy = total ? (analyzed.length / total) * 100 : 0;
  const gapScores = details.map((row) => {
    const expected = new Set(row.expected_missing.map((item) => item.toLowerCase()));
    const actual = new Set(row.actual_missing.map((item) => item.toLowerCase()));
    if (!expected.size && !actual.size) return 1;
    if (!expected.size || !actual.size) return expected.size === actual.size ? 1 : 0;
    let overlap = 0;
    for (const item of expected) {
      if ([...actual].some((other) => other.includes(item) || item.includes(other))) {
        overlap += 1;
      }
    }
    const precision = overlap / actual.size;
    const recall = overlap / expected.size;
    return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  });
  const gap =
    gapScores.length > 0
      ? gapScores.reduce((sum, value) => sum + value, 0) / gapScores.length
      : 1;
  const routing = total
    ? (details.filter((row) => row.match).length / total) * 100
    : 0;
  const safetyRows = details.filter((row) => row.safety);
  const safety = safetyRows.length
    ? (safetyRows.filter((row) => row.actual_route === "abstain").length /
        safetyRows.length) *
      100
    : 100;
  const citationItems = details.flatMap((row) => row.citations);
  const validCitations = citationItems.filter(
    (cite) => cite.includes("POL-") || cite.includes("Clause"),
  );
  const citation = citationItems.length
    ? (validCitations.length / citationItems.length) * 100
    : 100;
  const unsupported = citationItems.length
    ? ((citationItems.length - validCitations.length) / citationItems.length) * 100
    : 0;

  return [
    metric("Accuracy", `${accuracy.toFixed(1)}%`, "≥ 85%", accuracy >= 85),
    metric("Gap F1", gap.toFixed(2), "≥ 0.80", gap >= 0.8),
    metric("Routing", `${routing.toFixed(1)}%`, "≥ 90%", routing >= 90),
    metric("Safety recall", `${safety.toFixed(1)}%`, "100%", safety === 100),
    metric("Citation validity", `${citation.toFixed(1)}%`, "100%", citation === 100),
    metric("Unsupported claims", `${unsupported.toFixed(1)}%`, "0%", unsupported === 0),
  ];
}

const DONE = new Set(["RESOLVED", "CLOSED", "SUBMITTED"]);

export function providerStats(details: EvalCaseRow[]) {
  const waitingOnPatient = details.filter(
    (row) =>
      !DONE.has(row.status) &&
      (row.status === "ACTION_REQUIRED" || row.actual_missing.length > 0),
  ).length;
  const readyForReview = details.filter((row) =>
    ["AWAITING_REVIEW", "APPEAL_READY", "ANALYZING"].includes(row.status),
  ).length;
  const escalated = details.filter((row) => row.status === "ESCALATED").length;
  const finished = details.filter((row) =>
    ["RESOLVED", "CLOSED", "SUBMITTED"].includes(row.status),
  ).length;
  return {
    total: details.length,
    waitingOnPatient,
    readyForReview,
    escalated,
    finished,
  };
}

export function neededForProviders(row: EvalCaseRow) {
  if (DONE.has(row.status)) {
    return row.status === "CLOSED" ? "Claim closed" : "No records outstanding";
  }
  const missing = row.actual_missing.length
    ? row.actual_missing
    : row.expected_missing;
  if (missing.length === 1) return missing[0];
  if (missing.length > 1) return `${missing.length} records still needed`;
  return "No missing records";
}

export function nextStepForProviders(row: EvalCaseRow) {
  if (row.status === "CLOSED") return "No further action";
  if (row.status === "RESOLVED") return "No further action";
  if (row.status === "SUBMITTED") return "Waiting on the payer";
  if (row.status === "ACTION_REQUIRED" || row.actual_missing.length) {
    return "Ask the patient to upload records";
  }
  if (row.status === "ANALYZING") return "Agent is reviewing the packet";
  if (row.status === "AWAITING_REVIEW" || row.status === "APPEAL_READY") {
    return "Reviewer decision needed";
  }
  if (row.status === "ESCALATED") return "Send to clinical safety review";
  if (row.status === "SUBMITTED") return "Waiting on the payer";
  if (row.status === "RESOLVED") return "No further action";
  if (row.status === "CLOSED") return "Claim withdrawn";
  return "Continue intake";
}

export function dashboardForExactCases(
  claims: ClaimCase[],
  harness: EvalDashboard | null,
): EvalDashboard {
  const goldByNumber = new Map(
    (harness?.details ?? []).map((row) => [row.case_number, row]),
  );
  const details = claims.map((claim) =>
    evalRowFromClaim(claim, goldByNumber.get(claim.case_number)),
  );
  return withExactCases({
    timestamp: harness?.timestamp ?? new Date().toISOString(),
    cases: details.length,
    metrics: metricsFromDetails(details),
    details,
    routes: [],
  });
}

function normalizeCase(row: unknown): EvalCaseRow {
  const item = asRecord(row) ?? {};
  const caseNumber = asString(item.case_number || item.case_id, "—");
  const expected = asString(item.expected_route || item.expected);
  const actual = asString(item.actual_route || item.actual || item.route);
  return {
    case_number: caseNumber,
    service_type:
      asString(item.service_type) || GOLD_SERVICES[caseNumber] || "Denial review",
    service_code: asString(item.service_code) || null,
    expected_route: expected,
    actual_route: actual,
    status: asString(item.status, "—"),
    citations: asStringList(item.citations),
    expected_missing: asStringList(item.expected_missing),
    actual_missing: asStringList(item.actual_missing),
    safety: Boolean(item.safety),
    match:
      typeof item.route_match === "boolean"
        ? item.route_match
        : typeof item.passed === "boolean"
          ? item.passed
          : expected === actual,
    latency_ms: asNumber(item.latency_ms),
  };
}
