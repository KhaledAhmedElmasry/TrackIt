/**
 * MongoDB-Backed Rate Limiting Service
 *
 * Implements strict, serverless-safe rate limiting without paid Redis:
 * - Counters stored in MongoDB `rate_limits` collection.
 * - Automatic cleanup via native MongoDB TTL index on `expiresAt`.
 * - Zero in-memory state, fully consistent across distributed serverless lambdas.
 * - Enforces temporary lockouts after repeated authentication failures.
 */

import { getDb } from "../db/mongodb";
import { RateLimitError } from "../errors/app-error";

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  count: number;
  retryAfterSeconds: number;
}

export class RateLimitService {
  /**
   * Checks current rate limit status for a given key without incrementing.
   */
  static async check(
    key: string,
    maxAttempts: number
  ): Promise<RateLimitStatus> {
    const db = await getDb();
    const collection = db.collection("rate_limits");

    const record = await collection.findOne({ key });
    if (!record) {
      return {
        allowed: true,
        remaining: maxAttempts,
        count: 0,
        retryAfterSeconds: 0,
      };
    }

    const now = Date.now();
    const expiresAtMs = new Date(record.expiresAt).getTime();
    const retryAfterSeconds = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));

    const count = record.count || 0;
    const allowed = count < maxAttempts;
    const remaining = Math.max(0, maxAttempts - count);

    return {
      allowed,
      remaining,
      count,
      retryAfterSeconds,
    };
  }

  /**
   * Increments the rate limit counter and sets TTL expiry on initial insertion.
   *
   * @param key Unique identifier (e.g., "auth:login:192.168.1.1")
   * @param windowSeconds Duration in seconds until counter expires
   * @returns The updated count
   */
  static async increment(key: string, windowSeconds: number): Promise<number> {
    const db = await getDb();
    const collection = db.collection("rate_limits");

    const expiresAt = new Date(Date.now() + windowSeconds * 1000);

    const result = await collection.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt },
      },
      { upsert: true, returnDocument: "after" }
    );

    return result?.count || 1;
  }

  /**
   * Asserts that an action is allowed.
   * If exceeded, throws RateLimitError with a helpful retry-after message.
   */
  static async assert(
    key: string,
    maxAttempts: number
  ): Promise<void> {
    const status = await this.check(key, maxAttempts);

    if (!status.allowed) {
      const minutes = Math.ceil(status.retryAfterSeconds / 60);
      throw new RateLimitError(
        `Too many attempts. Account/IP temporarily locked. Please try again in ${
          minutes > 1 ? `${minutes} minutes` : `${status.retryAfterSeconds} seconds`
        }.`
      );
    }
  }

  /**
   * Clears the rate limit counter upon successful action (e.g. valid login).
   */
  static async reset(key: string): Promise<void> {
    const db = await getDb();
    const collection = db.collection("rate_limits");
    await collection.deleteOne({ key });
  }
}
