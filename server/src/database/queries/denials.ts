/**
 * Database query helpers for denials.
 */

import { supabase } from '../supabase.js';
import type { Denial } from '../../types/index.js';
import { NotFoundError } from '../../lib/errors.js';

export async function getDenialsByCase(caseId: string): Promise<Denial[]> {
  const { data, error } = await supabase
    .from('denials')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Denial[];
}

export async function getDenialById(id: string): Promise<Denial> {
  const { data, error } = await supabase.from('denials').select('*').eq('id', id).single();

  if (error || !data) throw new NotFoundError('Denial');
  return data as Denial;
}

export interface CreateDenialInput {
  case_id: string;
  denial_code?: string;
  denial_reason: string;
  denial_date?: string;
  appeal_deadline?: string;
  raw_text?: string;
  drive_file_id?: string;
}

export async function createDenialForCase(input: CreateDenialInput): Promise<Denial> {
  const { data, error } = await supabase.from('denials').insert(input).select().single();

  if (error) throw new Error(error.message);
  return data as Denial;
}

export async function updateDenialDriveFile(id: string, driveFileId: string): Promise<Denial> {
  const { data, error } = await supabase
    .from('denials')
    .update({ drive_file_id: driveFileId })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update denial');
  return data as Denial;
}
