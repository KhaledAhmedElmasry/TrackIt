/**
 * Environment Variables Zod Validation Schema
 *
 * Ensures all required secrets and configuration keys are validated
 * before runtime execution. Prevents insecure defaults or truncated encryption keys.
 */

import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine((val) => val.startsWith("mongodb://") || val.startsWith("mongodb+srv://"), {
      message: "MONGODB_URI must be a valid mongodb:// or mongodb+srv:// connection URI",
    }),
  MONGODB_DB_NAME: z.string().default("watchtrack"),
  // Master key for AES-256-GCM encryption of user TMDB and Gemini keys.
  // Must be 32 bytes represented as a 64-character hex string.
  MASTER_ENCRYPTION_KEY: z
    .string()
    .length(64, "MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256-GCM)")
    .regex(/^[0-9a-fA-F]+$/, "MASTER_ENCRYPTION_KEY must contain only valid hexadecimal characters"),
  // Secret used for HMAC generation and session integrity
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters long"),
  // Secret token expected in Authorization header for the daily cron route
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters long"),
  // Brevo transactional email API key (free tier 300/day)
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().default("TrackIt"),
  // Base URL for links in verification/reset emails
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates process.env against the schema.
 * Throws in production if missing mandatory variables; returns a parsed object.
 */
export function validateEnv(customEnv?: Record<string, string | undefined>): EnvConfig {
  const envToValidate = customEnv || process.env;
  return envSchema.parse(envToValidate);
}

