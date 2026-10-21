/**
 * Database Index Initializer
 *
 * Configures all required MongoDB indexes idempotently:
 * - Unique constraints on users, sessions, and tracked items
 * - High-speed compound indexes for user list tab screens
 * - Notification and daily cron job lookup indexes
 * - Automatic TTL indexes for sessions, rate limiting counters, and cache records
 *
 * Run by the daily cron job; every createIndex call is idempotent.
 */

import { Db } from "mongodb";
import { getDb } from "./mongodb";

export async function ensureIndexes(dbOverride?: Db): Promise<void> {
  const db = dbOverride || (await getDb());

  // 1. Users collection indexes
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true, name: "idx_user_email_unique" });
  await users.createIndex({ isVerified: 1, createdAt: 1 }, { name: "idx_unverified_cleanup" });

  // 2. Tracked Items collection indexes
  const trackedItems = db.collection("tracked_items");
  // Enforce one tracked document per title per user
  await trackedItems.createIndex(
    { userId: 1, tmdbId: 1, mediaType: 1 },
    { unique: true, name: "idx_user_title_unique" }
  );
  // High-performance compound index for user list screens (Want to Watch, Currently Watching, Watched)
  await trackedItems.createIndex(
    { userId: 1, status: 1, updatedAt: -1 },
    { name: "idx_user_status_sort" }
  );
  // Efficient index for daily cron job scanning opted-in series
  await trackedItems.createIndex(
    { mediaType: 1, notify: 1 },
    { name: "idx_cron_notify_series" }
  );

  // 3. Sessions collection with automatic TTL expiration
  const sessions = db.collection("sessions");
  await sessions.createIndex(
    { sessionTokenHash: 1 },
    { unique: true, name: "idx_session_token_unique" }
  );
  await sessions.createIndex({ userId: 1 }, { name: "idx_session_user" });
  await sessions.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "idx_session_ttl" }
  );

  // 4. Rate Limiting counters with automatic TTL
  const rateLimits = db.collection("rate_limits");
  await rateLimits.createIndex({ key: 1 }, { unique: true, name: "idx_ratelimit_key" });
  await rateLimits.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "idx_ratelimit_ttl" }
  );

  // 5. Shared TMDB metadata cache with automatic TTL
  const metadataCache = db.collection("metadata_cache");
  await metadataCache.createIndex({ cacheKey: 1 }, { unique: true, name: "idx_cache_key" });
  await metadataCache.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "idx_cache_ttl" }
  );

  // 6. In-app notifications: per-user listing and unread counts
  const notifications = db.collection("notifications");
  await notifications.createIndex(
    { userId: 1, read: 1, createdAt: -1 },
    { name: "idx_user_notifications_read" }
  );
}

