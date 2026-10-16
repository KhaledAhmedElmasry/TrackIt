/**
 * Cryptographic and Hashing Utilities
 *
 * Implements:
 * - Scrypt password hashing using Node.js built-in crypto (zero native compilation issues).
 * - Constant-time timing-safe hash comparison to prevent timing attacks.
 * - Single-use token generation with SHA-256 hashing for MongoDB storage.
 * - Human-readable one-time recovery backup codes.
 */

import crypto from "crypto";

// Scrypt configuration parameters
const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
};

/**
 * Hashes a plaintext password using Node's crypto.scrypt with a unique random salt.
 * Formats output as: scrypt$N$r$p$salt_hex$hash_hex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      const saltHex = salt.toString("hex");
      const hashHex = derivedKey.toString("hex");
      resolve(`scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${saltHex}$${hashHex}`);
    });
  });
}

/**
 * Verifies a password against a stored scrypt hash using timingSafeEqual.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const N = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = Buffer.from(parts[4], "hex");
  const originalKey = Buffer.from(parts[5], "hex");

  return new Promise((resolve) => {
    crypto.scrypt(password, salt, originalKey.length, { N, r, p }, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const isMatch = crypto.timingSafeEqual(originalKey, derivedKey);
        resolve(isMatch);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Generates a cryptographically secure random token (e.g. for sessions, resets, verifications).
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Computes a SHA-256 hash of a token.
 * Tokens are stored hashed in MongoDB so a database leak cannot compromise active sessions or reset tokens.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a batch of 10 human-readable one-time recovery backup codes.
 * Returns plaintext codes to display once to the user and hashed records for MongoDB storage.
 */
export interface GeneratedRecoveryCodes {
  plainCodes: string[];
  hashedCodes: Array<{ codeHash: string; used: boolean }>;
}

// Unambiguous character set (no 0/O, 1/I)
const RECOVERY_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateSingleRecoveryCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += RECOVERY_CHARS[bytes[i] % RECOVERY_CHARS.length];
    if (i === 3 || i === 7) {
      code += "-";
    }
  }
  return code; // Format: XXXX-XXXX-XXXX
}

export function generateRecoveryCodes(count = 10): GeneratedRecoveryCodes {
  const plainCodes: string[] = [];
  const hashedCodes: Array<{ codeHash: string; used: boolean }> = [];

  for (let i = 0; i < count; i++) {
    const code = generateSingleRecoveryCode();
    plainCodes.push(code);
    hashedCodes.push({
      codeHash: hashToken(code.replace(/-/g, "").toUpperCase()),
      used: false,
    });
  }

  return { plainCodes, hashedCodes };
}

/**
 * Normalizes a recovery code string for comparison (removes hyphens and uppercases).
 */
export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

