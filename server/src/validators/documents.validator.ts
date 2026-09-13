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

export const createDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(255),
  document_type: documentTypeEnum,
  drive_file_id: z.string().min(1, 'Google Drive file ID is required'),
  drive_url: z.string().url('Invalid Drive URL').optional(),
  is_missing: z.boolean().default(false),
});

export const markMissingSchema = z.object({
  is_missing: z.boolean(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type MarkMissingInput = z.infer<typeof markMissingSchema>;
