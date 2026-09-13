/**
 * Database query helpers for appeals.
 */

import { supabase } from '../supabase.js';
import type { Appeal, AppealStatus, PolicyCitation } from '../../types/index.js';
import { NotFoundError } from '../../lib/errors.js';

export async function getAppealByCase(caseId: string): Promise<Appeal | null> {
  const { data, error } = await supabase
    .from('appeals')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Appeal | null;
}

export async function getAppealById(id: string): Promise<Appeal> {
  const { data, error } = await supabase.from('appeals').select('*').eq('id', id).single();

  if (error || !data) throw new NotFoundError('Appeal');
  return data as Appeal;
}

export interface CreateAppealInput {
  case_id: string;
  appeal_text?: string;
  citations?: PolicyCitation[];
}

export async function createAppeal(input: CreateAppealInput): Promise<Appeal> {
  const { data, error } = await supabase.from('appeals').insert(input).select().single();

  if (error) throw new Error(error.message);
  return data as Appeal;
}

export async function updateAppealStatus(
  id: string,
  status: AppealStatus,
  approvedBy?: string,
): Promise<Appeal> {
  const update: Partial<Appeal> = { status };
  if (approvedBy) update.approved_by = approvedBy;
  if (status === 'SUBMITTED') update.submitted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('appeals')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update appeal');
  return data as Appeal;
}

export async function updateAppealText(
  id: string,
  appealText: string,
  citations?: PolicyCitation[],
): Promise<Appeal> {
  const { data, error } = await supabase
    .from('appeals')
    .update({ appeal_text: appealText, citations: citations ?? null })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update appeal text');
  return data as Appeal;
}
