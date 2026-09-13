/**
 * Database query helpers for case documents.
 */

import { supabase } from '../supabase.js';
import type { CaseDocument, DocumentType } from '../../types/index.js';
import { NotFoundError } from '../../lib/errors.js';

export async function getDocumentsByCase(caseId: string): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDocument[];
}

export async function getDocumentById(id: string): Promise<CaseDocument> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error || !data) throw new NotFoundError('Document');
  return data as CaseDocument;
}

export interface CreateDocumentInput {
  case_id: string;
  name: string;
  document_type: DocumentType;
  drive_file_id: string;
  drive_url?: string;
  uploaded_by?: string;
  is_missing?: boolean;
}

export async function createDocument(input: CreateDocumentInput): Promise<CaseDocument> {
  const { data, error } = await supabase.from('documents').insert(input).select().single();

  if (error) throw new Error(error.message);
  return data as CaseDocument;
}

export async function markDocumentMissing(id: string, isMissing: boolean): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from('documents')
    .update({ is_missing: isMissing })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update document');
  return data as CaseDocument;
}

export async function getMissingDocumentsByCase(caseId: string): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('case_id', caseId)
    .eq('is_missing', true);

  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDocument[];
}
