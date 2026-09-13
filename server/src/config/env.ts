/**
 * Centralized environment configuration with fail-fast validation.
 * Every external value consumed by the app must be declared here.
 * Import `env` instead of using `process.env` directly anywhere.
 */

import { z } from "zod";

const envSchema = z.object({
  // Server
<<<<<<< HEAD
  PORT: z.coerce.number().int().positive().default(5001),
  NODE_ENV: z.enum(['development', 'production', 'test'] as const).default('development'),
  DRY_RUN: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
=======
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DRY_RUN: z
    .string()
    .transform((v) => v.toLowerCase() === "true")
    .default("false"),
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d

  // Supabase
  SUPABASE_URL: z.string().url({ message: "SUPABASE_URL must be a valid URL" }),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // AI Server
  AI_SERVER_URL: z.string().url().default("http://localhost:8000"),
  AI_SERVER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Google
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().default('http://localhost:5001/oauth2callback'),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_SHEETS_ID: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GMAIL_SENDER_EMAIL: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),

  // Slack
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_APPROVAL_CHANNEL_ID: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // CORS
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim())),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
<<<<<<< HEAD
    console.error('❌ Invalid environment configuration:');
    result.error.issues.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
=======
    console.error("❌ Invalid environment configuration:");
    result.error.errors.forEach((err) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
>>>>>>> 8e03df3be291ef26f96390f030b1d64f10bb0d5d
    });
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();

export type Env = typeof env;
