/**
 * User API Key Management Service
 *
 * Coordinates AES-256-GCM encryption of user-supplied TMDB and Gemini keys.
 * Enforces strict isolation:
 * - Plaintext keys are encrypted immediately and never saved in raw form.
 * - Settings UI only receives masked status and last 4 characters.
 * - Decryption is strictly restricted to server-side external API callers.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import { encryptApiKey, decryptApiKey } from "../security/encryption";
import { AppError, NotFoundError, ValidationError } from "../errors/app-error";

export type KeyType = "tmdb" | "gemini";

export interface KeyStatusSummary {
  configured: boolean;
  lastFour?: string;
  updatedAt?: Date;
}

export interface UserKeysSummary {
  tmdb: KeyStatusSummary;
  gemini: KeyStatusSummary;
}

export class KeyService {
  /**
   * Encrypts and stores a user-supplied API key in their MongoDB document.
   */
  static async saveKey(
    userId: string | ObjectId,
    keyType: KeyType,
    plaintextKey: string
  ): Promise<{ lastFour: string }> {
    if (!plaintextKey || typeof plaintextKey !== "string" || plaintextKey.trim().length < 8) {
      throw new ValidationError(`Invalid ${keyType.toUpperCase()} API key format`);
    }

    const db = await getDb();
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const encryptedData = encryptApiKey(plaintextKey.trim());

    const result = await db.collection("users").updateOne(
      { _id: userObjectId },
      {
        $set: {
          [`keys.${keyType}`]: encryptedData,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError("User account not found");
    }

    return { lastFour: encryptedData.lastFour };
  }

  /**
   * Deletes a user's API key.
   */
  static async deleteKey(userId: string | ObjectId, keyType: KeyType): Promise<void> {
    const db = await getDb();
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    await db.collection("users").updateOne(
      { _id: userObjectId },
      {
        $unset: { [`keys.${keyType}`]: "" },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Returns a sanitized summary of user keys (configured status and last 4 chars only).
   * Safe for client presentation in the settings screen.
   */
  static async getKeySummary(userId: string | ObjectId): Promise<UserKeysSummary> {
    const db = await getDb();
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const user = await db
      .collection("users")
      .findOne({ _id: userObjectId }, { projection: { keys: 1 } });

    if (!user) {
      throw new NotFoundError("User account not found");
    }

    const tmdbKey = user.keys?.tmdb;
    const geminiKey = user.keys?.gemini;

    return {
      tmdb: {
        configured: Boolean(tmdbKey?.encrypted),
        lastFour: tmdbKey?.lastFour,
        updatedAt: tmdbKey?.updatedAt,
      },
      gemini: {
        configured: Boolean(geminiKey?.encrypted),
        lastFour: geminiKey?.lastFour,
        updatedAt: geminiKey?.updatedAt,
      },
    };
  }

  /**
   * Internal Server Helper: Decrypts the user key for upstream TMDB or Gemini API calls.
   * NEVER expose this output in API responses.
   */
  static async getDecryptedKey(
    userId: string | ObjectId,
    keyType: KeyType
  ): Promise<string | null> {
    const db = await getDb();
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    const user = await db
      .collection("users")
      .findOne({ _id: userObjectId }, { projection: { [`keys.${keyType}`]: 1 } });

    const keyData = user?.keys?.[keyType];
    if (!keyData || !keyData.encrypted) {
      return null;
    }

    try {
      return decryptApiKey(keyData);
    } catch {
      throw new AppError(
        `Failed to decrypt your ${keyType.toUpperCase()} API key. Please re-enter it in Settings.`,
        500,
        "INTERNAL_SERVER_ERROR"
      );
    }
  }
}
