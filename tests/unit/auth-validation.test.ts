import { describe, it, expect } from "vitest";
import {
  signupSchema,
  loginSchema,
  resetPasswordWithRecoveryCodeSchema,
  saveKeySchema,
} from "@/lib/validations/auth.schema";

describe("Authentication Input Validation Schemas", () => {
  describe("signupSchema", () => {
    it("should accept valid email and strong password", () => {
      const valid = { email: "user@example.com", password: "Password123" };
      const result = signupSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const invalid = { email: "not-an-email", password: "Password123" };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject password shorter than 8 characters", () => {
      const invalid = { email: "user@example.com", password: "Pass1" };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject password without numbers", () => {
      const invalid = { email: "user@example.com", password: "PasswordOnly" };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject password without letters", () => {
      const invalid = { email: "user@example.com", password: "123456789" };
      const result = signupSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("loginSchema", () => {
    it("should accept valid email and password", () => {
      const valid = { email: "user@example.com", password: "AnyPassword" };
      expect(loginSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("resetPasswordWithRecoveryCodeSchema", () => {
    it("should accept valid email, recovery code and new password", () => {
      const valid = {
        email: "user@example.com",
        recoveryCode: "ABCD-EFGH-JK23",
        newPassword: "NewSecurePassword123",
      };
      expect(resetPasswordWithRecoveryCodeSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("saveKeySchema", () => {
    it("should accept valid tmdb and gemini key entries", () => {
      expect(saveKeySchema.safeParse({ keyType: "tmdb", key: "valid_tmdb_key_123" }).success).toBe(
        true
      );
      expect(
        saveKeySchema.safeParse({ keyType: "gemini", key: "valid_gemini_key_123" }).success
      ).toBe(true);
    });

    it("should reject unknown keyType or too-short keys", () => {
      expect(saveKeySchema.safeParse({ keyType: "unknown", key: "12345678" }).success).toBe(false);
      expect(saveKeySchema.safeParse({ keyType: "tmdb", key: "short" }).success).toBe(false);
    });
  });
});

