import { describe, it, expect } from "vitest";
import { envSchema } from "@/lib/validations/env.schema";

describe("Environment Variables Schema Validation", () => {
  const validEnv = {
    NODE_ENV: "development",
    MONGODB_URI: "mongodb+srv://user:pass@cluster0.mongodb.net/watchtrack?retryWrites=true&w=majority",
    MONGODB_DB_NAME: "watchtrack",
    MASTER_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    SESSION_SECRET: "this-is-a-very-long-and-secure-session-secret-key-32chars",
    CRON_SECRET: "cron_secret_bearer_token_12345",
    APP_URL: "http://localhost:3000",
  };

  it("should validate a completely valid environment configuration", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("should fail when MONGODB_URI has an invalid protocol", () => {
    const invalid = { ...validEnv, MONGODB_URI: "postgres://localhost:5432/db" };
    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("mongodb:// or mongodb+srv://");
    }
  });

  it("should fail when MASTER_ENCRYPTION_KEY is not 64 hex characters (32 bytes)", () => {
    const invalid = { ...validEnv, MASTER_ENCRYPTION_KEY: "short_key" };
    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should fail when MASTER_ENCRYPTION_KEY contains non-hexadecimal characters", () => {
    const invalid = {
      ...validEnv,
      MASTER_ENCRYPTION_KEY: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    };
    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should fail when SESSION_SECRET is too short (<32 chars)", () => {
    const invalid = { ...validEnv, SESSION_SECRET: "short" };
    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should fail when CRON_SECRET is too short (<16 chars)", () => {
    const invalid = { ...validEnv, CRON_SECRET: "short" };
    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

