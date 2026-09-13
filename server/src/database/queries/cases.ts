/**
 * Database query helpers for cases.
 * All Supabase queries for the cases table live here.
 */

import { supabase } from '../supabase.js';
import type { Case, CaseStatus, PaginationParams, PaginatedResult } from '../../types/index.js';
import { NotFoundError } from '../../lib/errors.js';

// ─── List ──────────────────────────────────────────────────────────────────────

export interface ListCasesFilter {
  patient_id?: string;
  insurer_org_id?: string;
  status?: CaseStatus;
}

export async function listCases(
  filter: ListCasesFilter,
  pagination: PaginationParams,
): Promise<PaginatedResult<Case>> {
  const { page, limit } = pagination;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('cases').select('*', { count: 'exact' });

  if (filter.patient_id) query = query.eq('patient_id', filter.patient_id);
  if (filter.insurer_org_id) query = query.eq('insurer_org_id', filter.insurer_org_id);
  if (filter.status) query = query.eq('status', filter.status);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  return {
    data: (data ?? []) as Case[],
    total: count ?? 0,
    page,
    limit,
    hasMore: (count ?? 0) > to + 1,
  };
}

// ─── Get One ───────────────────────────────────────────────────────────────────

export async function getCaseById(id: string): Promise<Case> {
  const { data, error } = await supabase.from('cases').select('*').eq('id', id).single();

  if (error || !data) throw new NotFoundError('Case');
  return data as Case;
}

export async function getCaseByNumber(caseNumber: string): Promise<Case> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('case_number', caseNumber)
    .single();

  if (error || !data) throw new NotFoundError('Case');
  return data as Case;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateCaseInput {
  case_number: string;
  patient_id: string;
  insurer_org_id: string;
  service_type: string;
  service_code?: string;
  payer_id?: string;
}

export async function createCase(input: CreateCaseInput): Promise<Case> {
  const { data, error } = await supabase.from('cases').insert(input).select().single();

  if (error) throw new Error(error.message);
  return data as Case;
}

// ─── Update Status ─────────────────────────────────────────────────────────────

export async function updateCaseStatus(id: string, status: CaseStatus): Promise<Case> {
  const { data, error } = await supabase
    .from('cases')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update case');
  return data as Case;
}

// ─── Get with Related Data ─────────────────────────────────────────────────────

export async function getCaseWithDetails(id: string): Promise<Record<string, unknown>> {
  const [caseResult, denialsResult, documentsResult, appealsResult, auditResult] =
    await Promise.all([
      supabase.from('cases').select('*').eq('id', id).single(),
      supabase.from('denials').select('*').eq('case_id', id),
      supabase.from('documents').select('*').eq('case_id', id),
      supabase.from('appeals').select('*').eq('case_id', id),
      supabase.from('audit_logs').select('*').eq('case_id', id).order('created_at'),
    ]);

  if (caseResult.error || !caseResult.data) throw new NotFoundError('Case');

  return {
    ...(caseResult.data as Record<string, unknown>),
    denials: denialsResult.data ?? [],
    documents: documentsResult.data ?? [],
    appeals: appealsResult.data ?? [],
    audit_trail: auditResult.data ?? [],
  };
}
