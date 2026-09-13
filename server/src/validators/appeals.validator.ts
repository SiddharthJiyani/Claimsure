import { z } from "zod";

const citationSchema = z.object({
  policy_id: z.string().min(1),
  clause: z.string().min(1),
  text: z.string().min(1),
});

export const createAppealSchema = z.object({
  appeal_text: z
    .string()
    .min(10, "Appeal text must be at least 10 characters")
    .optional(),
  citations: z.array(citationSchema).optional(),
});

export const updateAppealSchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "SUBMITTED", "REJECTED"]),
  appeal_text: z.string().optional(),
  citations: z.array(citationSchema).optional(),
});

export type CreateAppealInput = z.infer<typeof createAppealSchema>;
export type UpdateAppealInput = z.infer<typeof updateAppealSchema>;
