/**
 * Validator for the multipart document upload endpoint.
 * File bytes are handled by multer; this validates the non-file form fields.
 */

import { z } from 'zod';

const documentTypeEnum = z.enum([
  'denial_letter',
  'clinical_note',
  'mri_report',
  'lab_result',
  'prior_auth_form',
  'appeal_letter',
  'policy_document',
  'other',
] as const);

export const uploadDocumentFieldsSchema = z.object({
  /** document_type must match the DB enum */
  document_type: documentTypeEnum.default('denial_letter'),

  /** Human-readable override for the stored document name (defaults to original filename) */
  display_name: z.string().max(255).optional(),

  /** Passed through to the AI server for RAG context */
  payer_id: z.string().optional(),
  service_code: z.string().optional(),
  patient_name: z.string().optional(),

  /**
   * If true, skip calling the AI server after Drive upload.
   * Useful when you only want to attach supporting evidence without re-running the agent.
   */
  skip_ai: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
});

export type UploadDocumentFields = z.infer<typeof uploadDocumentFieldsSchema>;
