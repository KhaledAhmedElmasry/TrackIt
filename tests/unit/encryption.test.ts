import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey } from "@/lib/security/encryption";
import { AppError } from "@/lib/errors/app-error";

describe("AES-256-GCM API Key Encryption & Decryption", () => {
  const testMasterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("should encrypt and decrypt a plaintext API key successfully", () => {
    const rawKey = "tmdb_api_secret_key_1234567890abcdef";
    const encryptedData = encryptApiKey(rawKey, testMasterKey);

    expect(encryptedData.encrypted).toBeDefined();
    expect(encryptedData.iv).toHaveLength(24); // 12 bytes in hex
    expect(encryptedData.authTag).toHaveLength(32); // 16 bytes in hex
    expect(encryptedData.keyVersion).toBe(1);
    expect(encryptedData.lastFour).toBe("cdef");

    const decrypted = decryptApiKey(encryptedData, testMasterKey);
    expect(decrypted).toBe(rawKey);
  });

  it("should fail decryption when ciphertext has been tampered with", () => {
    const rawKey = "valid_key_to_be_tampered";
    const encryptedData = encryptApiKey(rawKey, testMasterKey);

    // Tamper with ciphertext
    const tampered = {
      ...encryptedData,
      encrypted: encryptedData.encrypted.slice(0, -2) + "ff",
    };

    expect(() => decryptApiKey(tampered, testMasterKey)).toThrowError(AppError);
  });

  it("should fail decryption when auth tag has been modified", () => {
    const rawKey = "valid_key_with_tampered_tag";
    const encryptedData = encryptApiKey(rawKey, testMasterKey);

    // Tamper with authTag
    const tampered = {
      ...encryptedData,
      authTag: "00000000000000000000000000000000",
    };

    expect(() => decryptApiKey(tampered, testMasterKey)).toThrowError(AppError);
  });

  it("should fail decryption when decrypted with a different master key", () => {
    const differentKey = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    const rawKey = "key_encrypted_with_first_key";
    const encryptedData = encryptApiKey(rawKey, testMasterKey);

    expect(() => decryptApiKey(encryptedData, differentKey)).toThrowError(AppError);
  });

  it("should reject empty or invalid plaintext keys", () => {
    expect(() => encryptApiKey("", testMasterKey)).toThrowError(AppError);
    expect(() => encryptApiKey("   ", testMasterKey)).toThrowError(AppError);
  });
});

