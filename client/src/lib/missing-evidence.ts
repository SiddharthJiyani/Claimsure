import type { AgentState, ClaimCase, DocumentRecord } from "@/lib/types";

export function normalizeEvidenceLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function inferDocumentType(label: string) {
  const name = label.toLowerCase();
  if (name.includes("mri") || name.includes("x-ray") || name.includes("imaging")) {
    return "mri_report";
  }
  if (name.includes("lab")) return "lab_result";
  if (name.includes("prescription") || name.includes("order")) {
    return "prior_auth_form";
  }
  return "clinical_note";
}

export function latestAgentState(states: AgentState[] | undefined) {
  return [...(states ?? [])].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function agentMissingLabels(states: AgentState[] | undefined): string[] {
  const state = latestAgentState(states)?.state_data ?? {};
  const labels = [
    ...asStringList(state.evidence_missing),
    ...asStringList(state.missing_evidence),
  ];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const label of labels) {
    const key = normalizeEvidenceLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }
  return unique;
}

export function hasMatchingDocument(
  documents: DocumentRecord[] | undefined,
  label: string,
  onlyMissing = false,
) {
  const key = normalizeEvidenceLabel(label);
  return (documents ?? []).some((doc) => {
    if (onlyMissing && !doc.is_missing) return false;
    return normalizeEvidenceLabel(doc.name) === key;
  });
}

export function uniqueDocumentsByName(documents: DocumentRecord[] | undefined) {
  const seen = new Map<string, DocumentRecord>();
  for (const doc of documents ?? []) {
    const key = normalizeEvidenceLabel(doc.name);
    const current = seen.get(key);
    if (!current) {
      seen.set(key, doc);
      continue;
    }
    if (current.is_missing && !doc.is_missing) {
      seen.set(key, doc);
    }
  }
  return [...seen.values()];
}

export function uniqueMissingDocuments(documents: DocumentRecord[] | undefined) {
  return uniqueDocumentsByName(documents).filter((doc) => doc.is_missing);
}

export function claimNeedsPatientAction(claim: Pick<ClaimCase, "status" | "documents" | "agent_state">) {
  if (claim.status === "RESOLVED" || claim.status === "CLOSED") return false;
  if (claim.status === "ACTION_REQUIRED") return true;
  return unresolvedMissingLabels(claim.documents, claim.agent_state).length > 0;
}

export function unresolvedMissingLabels(
  documents: DocumentRecord[] | undefined,
  states: AgentState[] | undefined,
) {
  const fromDocs = (documents ?? [])
    .filter((doc) => doc.is_missing)
    .map((doc) => doc.name);
  const fromAgent = agentMissingLabels(states).filter(
    (label) => !hasMatchingDocument(documents, label, false) ||
      hasMatchingDocument(documents, label, true),
  );
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const label of [...fromDocs, ...fromAgent]) {
    const key = normalizeEvidenceLabel(label);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}
