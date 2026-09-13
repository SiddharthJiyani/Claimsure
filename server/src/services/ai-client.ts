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
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
  return request<ProcessCaseResult>('POST', '/api/process-case', {
    case_id: caseId,
    dry_run: dryRun || env.DRY_RUN,
  });
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
