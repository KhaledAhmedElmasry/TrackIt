import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from "@/lib/security/crypto";

describe("Cryptographic Utilities & Scrypt Hashing", () => {
  it("should hash a password and format as scrypt string", async () => {
    const password = "SecurePassword123!";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it("should verify correct password against scrypt hash", async () => {
    const password = "MySecretPassword999";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(password, hash);
    expect(isMatch).toBe(true);
  });

  it("should reject incorrect password against scrypt hash", async () => {
    const password = "MySecretPassword999";
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword("WrongPassword123", hash);
    expect(isMatch).toBe(false);
  });

  it("should generate cryptographically random tokens and SHA-256 hashes", () => {
    const token1 = generateRandomToken(32);
    const token2 = generateRandomToken(32);

    expect(token1).toHaveLength(64); // 32 bytes in hex
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1 = hashToken(token1);
    const hash2 = hashToken(token1);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2); // Deterministic hash
  });

  it("should generate exactly 10 formatted one-time recovery backup codes", () => {
    const { plainCodes, hashedCodes } = generateRecoveryCodes(10);

    expect(plainCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);

    for (const code of plainCodes) {
      // Format: XXXX-XXXX-XXXX
      expect(code).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    }

    for (const record of hashedCodes) {
      expect(record.codeHash).toHaveLength(64);
      expect(record.used).toBe(false);
    }
  });

  it("should normalize recovery code by stripping hyphens, spaces and capitalizing", () => {
    expect(normalizeRecoveryCode("abcd-efgh-jk23")).toBe("ABCDEFGHJK23");
    expect(normalizeRecoveryCode("  ab cd - ef gh - jk 23  ")).toBe("ABCDEFGHJK23");
  });
});
