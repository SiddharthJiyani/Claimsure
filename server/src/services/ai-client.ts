/**
 * AI Server HTTP client — calls the Python FastAPI ai-server.
 * All agent processing requests flow through here.
 */


import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { ServiceUnavailableError } from '../lib/errors.js';

const BASE_URL = env.AI_SERVER_URL;
const TIMEOUT_MS = env.AI_SERVER_TIMEOUT_MS;

// ─── Types mirroring the ai-server response shapes ────────────────────────────

export interface ProcessCaseResult {
  case_id: string;
  final_node: string;
  status: string;
  confidence: number;
  appeal_text?: string;
  citations?: Array<{ policy_id: string; clause: string; text: string }>;
  evidence_found: string[];
  evidence_missing: string[];
  route_decision: 'automatable' | 'human_review' | 'abstain';
  actions_taken: string[];
  audit_trail: Array<{
    node: string;
    action: string;
    timestamp: string;
    confidence?: number;
  }>;
}

export interface EvalResults {
  total_cases: number;
  run_at: string;
  metrics: {
    denial_classification_accuracy: number;
    evidence_gap_f1: number;
    routing_accuracy: number;
    safety_escalation_recall: number;
    citation_validity: number;
    unsupported_claim_rate: number;
    median_latency_ms: number;
    tool_failures_recovered: number;
  };
  per_case: Array<{
    case_id: string;
    expected: string;
    actual: string;
    passed: boolean;
    latency_ms: number;
  }>;
}

export interface RAGSearchResult {
  policy_id: string;
  clause: string;
  text: string;
  score: number;
}

interface WorkflowProcessResponse {
  success: boolean;
  case_state: {
    case_id: string;
    current_node?: string;
    status: string;
    confidence: number;
    appeal_letter?: string;
    citations?: string[];
    found_evidence?: string[];
    missing_evidence?: string[];
    route?: 'act' | 'await_human' | 'abstain';
    actions_dispatched?: Array<{ app: string; action_type: string; status: string }>;
    node_trace?: Array<{
      node: string;
      summary: string;
      timestamp: string;
      details?: { confidence?: number };
    }>;
  };
}

// ─── HTTP Helper ───────────────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`AI server returned ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ServiceUnavailableError('AI Server (timeout)');
    }
    logger.error('AI server request failed', err, { path });
    throw new ServiceUnavailableError('AI Server');
  } finally {
    clearTimeout(timeout);
  }
}

// ─── AI Server Operations ─────────────────────────────────────────────────────

/**
 * processCase — triggers the full 9-node agent on a case.
 */
export async function processCase(caseId: string, dryRun = false): Promise<ProcessCaseResult> {
  const response = await request<WorkflowProcessResponse>('POST', '/api/workflow/process-case', {
    case_id: caseId,
    dry_run: dryRun || env.DRY_RUN,
  });

  const state = response.case_state;
  const routeDecision =
    state.route === 'act' ? 'automatable' :
    state.route === 'await_human' ? 'human_review' :
    'abstain';

  return {
    case_id: state.case_id,
    final_node: state.current_node ?? state.status.toLowerCase(),
    status: state.status,
    confidence: state.confidence,
    ...(state.appeal_letter !== undefined ? { appeal_text: state.appeal_letter } : {}),
    citations: (state.citations ?? []).map((citation) => ({
      policy_id: citation.split(':')[0] ?? citation,
      clause: citation,
      text: citation,
    })),
    evidence_found: state.found_evidence ?? [],
    evidence_missing: state.missing_evidence ?? [],
    route_decision: routeDecision,
    actions_taken: (state.actions_dispatched ?? []).map((action) =>
      `${action.app}:${action.action_type}:${action.status}`,
    ),
    audit_trail: (state.node_trace ?? []).map((item) => ({
      node: item.node,
      action: item.summary,
      timestamp: item.timestamp,
      ...(item.details?.confidence !== undefined ? { confidence: item.details.confidence } : {}),
    })),
  };
}

/**
 * getCaseTrace — retrieves the agent's audit trail for a case.
 */
export async function getCaseTrace(caseId: string): Promise<{ audit_trail: ProcessCaseResult['audit_trail'] }> {
  return request<{ audit_trail: ProcessCaseResult['audit_trail'] }>('GET', `/api/case/${caseId}/trace`);
}

/**
 * getEvalResults — retrieves the latest evaluation harness results.
 */
export async function getEvalResults(): Promise<EvalResults> {
  return request<EvalResults>('GET', '/api/eval/results');
}

/**
 * ragSearch — runs a direct RAG query (for debugging / MCP tool).
 */
export async function ragSearch(
  query: string,
  payerId?: string,
  serviceCode?: string,
): Promise<RAGSearchResult[]> {
  return request<RAGSearchResult[]>('GET', `/api/rag/search?q=${encodeURIComponent(query)}${payerId ? `&payer_id=${payerId}` : ''}${serviceCode ? `&service_code=${serviceCode}` : ''}`);
}

// ─── Upload + Analyze ─────────────────────────────────────────────────────────

export interface UploadAndAnalyzeOptions {
  caseId?: string;
  caseNumber?: string;
  patientName?: string;
  payerId?: string;
  serviceCode?: string;
}

/**
 * uploadAndAnalyze — streams file bytes to the Python AI server's multipart
 * upload-and-analyze endpoint. Returns a normalized ProcessCaseResult.
 *
 * The Python server handles text extraction (PDF or plain text), then runs the
 * full 9-node agent: parse_denial → retrieve_requirements → scan_evidence →
 * compute_gap → route → act → await_human → assemble_appeal → verify.
 */
export async function uploadAndAnalyze(
  fileBuffer: Buffer,
  filename: string,
  opts: UploadAndAnalyzeOptions = {},
): Promise<ProcessCaseResult> {
  const controller = new AbortController();
  // File processing is slower — give it a more generous timeout
  const timeout = setTimeout(() => controller.abort(), Math.max(TIMEOUT_MS, 120_000));

  try {
    const form = new FormData();
    // Wrap in a fresh ArrayBuffer so TypeScript strict lib is satisfied (Blob requires ArrayBuffer, not ArrayBufferLike)
    const arrayBuf = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    form.append('file', new globalThis.Blob([arrayBuf as ArrayBuffer]), filename);
    if (opts.caseId) form.append('case_id', opts.caseId);
    if (opts.caseNumber) form.append('case_number', opts.caseNumber);
    if (opts.patientName) form.append('patient_name', opts.patientName);
    if (opts.payerId) form.append('payer_id', opts.payerId);
    if (opts.serviceCode) form.append('service_code', opts.serviceCode);

    const res = await fetch(`${BASE_URL}/api/workflow/upload-and-analyze`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error');
      throw new Error(`AI server upload-and-analyze returned ${res.status}: ${text}`);
    }

    const json = await res.json() as { success: boolean; case_state: WorkflowProcessResponse['case_state'] };
    const state = json.case_state;

    const routeDecision =
      state.route === 'act' ? 'automatable' :
      state.route === 'await_human' ? 'human_review' :
      'abstain';

    return {
      case_id: state.case_id,
      final_node: state.current_node ?? state.status.toLowerCase(),
      status: state.status,
      confidence: state.confidence,
      ...(state.appeal_letter !== undefined ? { appeal_text: state.appeal_letter } : {}),
      citations: (state.citations ?? []).map((citation) => ({
        policy_id: citation.split(':')[0] ?? citation,
        clause: citation,
        text: citation,
      })),
      evidence_found: state.found_evidence ?? [],
      evidence_missing: state.missing_evidence ?? [],
      route_decision: routeDecision,
      actions_taken: (state.actions_dispatched ?? []).map((action) =>
        `${action.app}:${action.action_type}:${action.status}`,
      ),
      audit_trail: (state.node_trace ?? []).map((item) => ({
        node: item.node,
        action: item.summary,
        timestamp: item.timestamp,
        ...(item.details?.confidence !== undefined ? { confidence: item.details.confidence } : {}),
      })),
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ServiceUnavailableError('AI Server (upload timeout)');
    }
    logger.error('AI server upload-and-analyze failed', err, { filename });
    throw new ServiceUnavailableError('AI Server');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * healthCheck — verifies the AI server is up.
 */
export async function healthCheck(): Promise<{ status: 'ok' | 'error' }> {
  try {
    return await request<{ status: 'ok' | 'error' }>('GET', '/health');
  } catch {
    return { status: 'error' };
  }
}
