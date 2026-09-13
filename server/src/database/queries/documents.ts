/**
 * Database query helpers for case documents.
 */

import { supabase } from "../supabase.js";
import type { CaseDocument, DocumentType } from "../../types/index.js";
import { NotFoundError } from "../../lib/errors.js";

export async function getDocumentsByCase(
  caseId: string,
): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDocument[];
}

export async function getDocumentById(id: string): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) throw new NotFoundError("Document");
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

export async function createDocument(
  input: CreateDocumentInput,
): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from("documents")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as CaseDocument;
}

export async function markDocumentMissing(
  id: string,
  isMissing: boolean,
): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from("documents")
    .update({ is_missing: isMissing })
    .eq("id", id)
    .select()
    .single();

  if (error || !data)
    throw new Error(error?.message ?? "Failed to update document");
  return data as CaseDocument;
}

export function inferDocumentType(label: string): DocumentType {
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

export async function ensureMissingDocuments(
  caseId: string,
  labels: string[],
): Promise<CaseDocument[]> {
  const existing = await getDocumentsByCase(caseId);
  const created: CaseDocument[] = [];
  for (const label of labels) {
    const name = label.trim();
    if (!name) continue;
    const already = existing.some(
      (doc) =>
        doc.is_missing &&
        doc.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (already) continue;
    created.push(
      await createDocument({
        case_id: caseId,
        name,
        document_type: inferDocumentType(name),
        drive_file_id: "pending",
        is_missing: true,
      }),
    );
  }
  return created;
}

export async function fulfillMissingDocument(
  id: string,
  input: {
    drive_file_id: string;
    drive_url?: string | null;
    uploaded_by?: string;
    name?: string;
  },
): Promise<CaseDocument> {
  const { data, error } = await supabase
    .from("documents")
    .update({
      is_missing: false,
      drive_file_id: input.drive_file_id,
      drive_url: input.drive_url ?? null,
      ...(input.uploaded_by ? { uploaded_by: input.uploaded_by } : {}),
      ...(input.name ? { name: input.name } : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Failed to update document");
  return data as CaseDocument;
}

export async function getMissingDocumentsByCase(
  caseId: string,
): Promise<CaseDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseId)
    .eq("is_missing", true);

  if (error) throw new Error(error.message);
  return (data ?? []) as CaseDocument[];
}
