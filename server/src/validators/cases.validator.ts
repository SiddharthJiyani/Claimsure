import { z } from "zod";

const caseStatusEnum = z.enum([
  'PENDING',
  'ANALYZING',
  'ACTION_REQUIRED',
  'AWAITING_REVIEW',
  'APPEAL_READY',
  'SUBMITTED',
  'VERIFYING',
  'RESOLVED',
  'ESCALATED',
  'CLOSED',
] as const);

export const createCaseSchema = z.object({
  patient_id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Invalid patient ID",
    ),
  insurer_org_id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Invalid insurer organization ID",
    ),
  service_type: z.string().min(1, "Service type is required").max(200),
  service_code: z.string().max(50).optional(),
  payer_id: z.string().max(100).optional(),
  denial_code: z.string().max(50).optional(),
  denial_reason: z
    .string()
    .min(1, "Denial reason is required")
    .max(2000)
    .optional(),
  denial_date: z.string().date("Invalid date format (YYYY-MM-DD)").optional(),
  appeal_deadline: z
    .string()
    .date("Invalid date format (YYYY-MM-DD)")
    .optional(),
});

export const updateCaseStatusSchema = z.object({
  status: caseStatusEnum,
});

export const listCasesQuerySchema = z.object({
  status: caseStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const processCaseSchema = z.object({
  dry_run: z.boolean().default(false),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;
export type ListCasesQuery = z.infer<typeof listCasesQuerySchema>;
export type ProcessCaseInput = z.infer<typeof processCaseSchema>;
