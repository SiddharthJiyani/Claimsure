import { z } from "zod";

export const signUpSchema = z.object({
<<<<<<< HEAD
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  role: z.enum(['patient', 'insurance_provider'] as const, {
    error: () => ({ message: 'Role must be either patient or insurance_provider' }),
=======
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  role: z.enum(["patient", "insurance_provider"], {
    errorMap: () => ({
      message: "Role must be either patient or insurance_provider",
    }),
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
  }),
  organization_id: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Invalid organization ID",
    )
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
