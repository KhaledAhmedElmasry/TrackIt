/**
 * AES-256-GCM API Key Encryption and Decryption Service
 *
 * Implements authenticated encryption at rest for user-supplied TMDB and Gemini keys:
 * - Cipher: aes-256-gcm
 * - 32-byte master encryption key from environment variables
 * - Unique cryptographically random 12-byte IV per record
 * - 16-byte GCM authentication tag for tamper detection
 * - keyVersion field supporting seamless future key rotations
 *
 * Plaintext keys NEVER leave the server or appear in logs.
 */

import crypto from "crypto";
import { EncryptedKeyData } from "../models/types";
import { AppError } from "../errors/app-error";

const ALGORITHM = "aes-256-gcm";
const CURRENT_KEY_VERSION = 1;
const IV_LENGTH = 12; // 96-bit recommended IV for GCM

/**
 * Retrieves and validates the 32-byte master encryption key from environment.
 */
function getMasterKeyBuffer(overrideKeyHex?: string): Buffer {
  const hex = overrideKeyHex || process.env.MASTER_ENCRYPTION_KEY;

  if (!hex || hex.length !== 64) {
    throw new AppError(
      "Configuration error: MASTER_ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes)",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }

  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext API key with AES-256-GCM.
 *
 * @param plaintext The raw user-supplied API key
 * @param overrideKeyHex Optional test/custom master key
 * @returns EncryptedKeyData containing cipher, IV, authTag, keyVersion, and last 4 characters
 */
export function encryptApiKey(plaintext: string, overrideKeyHex?: string): EncryptedKeyData {
  if (!plaintext || typeof plaintext !== "string" || plaintext.trim().length === 0) {
    throw new AppError("Invalid API key provided for encryption", 400, "VALIDATION_ERROR");
  }

  const masterKey = getMasterKeyBuffer(overrideKeyHex);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  let encrypted = cipher.update(plaintext.trim(), "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  const trimmed = plaintext.trim();
  const lastFour = trimmed.length >= 4 ? trimmed.slice(-4) : trimmed;

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    keyVersion: CURRENT_KEY_VERSION,
    lastFour,
    updatedAt: new Date(),
  };
}

/**
 * Decrypts an EncryptedKeyData record back to plaintext for server-side API calls.
 * Fails safely if authentication tag or ciphertext was tampered with.
 *
 * @param data The encrypted container from MongoDB
 * @param overrideKeyHex Optional test/custom master key
 * @returns Plaintext key string
 */
export function decryptApiKey(data: EncryptedKeyData, overrideKeyHex?: string): string {
  if (!data || !data.encrypted || !data.iv || !data.authTag) {
    throw new AppError("Invalid or incomplete encrypted key data", 400, "VALIDATION_ERROR");
  }

  const masterKey = getMasterKeyBuffer(overrideKeyHex);
  const iv = Buffer.from(data.iv, "hex");
  const authTag = Buffer.from(data.authTag, "hex");

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(data.encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    // Decryption failure indicates key mismatch, corrupted data, or tampering
    throw new AppError(
      "Failed to decrypt user API key. The key may be corrupted or encrypted with a different master key.",
      500,
      "INTERNAL_SERVER_ERROR",
      { originalError: err instanceof Error ? err.message : "Decryption error" }
    );
  }
}
