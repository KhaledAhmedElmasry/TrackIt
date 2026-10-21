import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse, connection } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { ensureIndexes } from "@/lib/db/init-indexes";
import { getAppUrl } from "@/lib/utils/app-url";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";
import { NotificationService } from "@/lib/services/notification.service";
import { TrackedItemDocument, UserDocument } from "@/lib/models/types";

export const maxDuration = 60; // Up to 60 seconds where supported

function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/daily
 *
 * Daily automated cron job:
 * 1. Checks new episode releases for all series with opted-in users.
 * 2. Deduplicates TMDB calls across users to preserve free API quotas.
 * 3. Updates status from "watched" to "currently_watching" when new episodes air.
 * 4. Creates in-app notifications and sends ONE combined daily ntfy/Bark push per user.
 * 5. Cleans up unverified accounts > 7 days, read notifications > 30 days, expired sessions & tokens.
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  await connection();
  try {
    // Verify Cron Secret
    const authHeader = req.headers.get("authorization");
    const cronSecretHeader = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET environment variable is not configured" },
        { status: 500 }
      );
    }

    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const isAuthorized =
      secretMatches(bearerToken, expectedSecret) || secretMatches(cronSecretHeader, expectedSecret);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid cron secret" },
        { status: 401 }
      );
    }

    const db = await getDb();
    const startTime = Date.now();

    // --- Step 1: Query all tracked TV series with notify: true ---
    const optedInItems = await db
      .collection<TrackedItemDocument>("tracked_items")
      .find({
        mediaType: "tv",
        notify: true,
      })
      .toArray();

    // Group items by tmdbId: tmdbId -> TrackedItemDocument[]
    const seriesMap = new Map<number, TrackedItemDocument[]>();
    for (const item of optedInItems) {
      const list = seriesMap.get(item.tmdbId) || [];
      list.push(item);
      seriesMap.set(item.tmdbId, list);
    }

    let processedSeriesCount = 0;
    let newEpisodesDetected = 0;

    // Per-user new episodes queue: userIdStr -> Array<{ seriesTitle, season, episode, airDate, tmdbId }>
    const userUpdatesQueue = new Map<
      string,
      Array<{
        seriesTitle: string;
        seasonNumber: number;
        episodeNumber: number;
        airDate: string;
        tmdbId: number;
      }>
    >();

    // --- Step 2: For each unique series, fetch TMDB using an opted-in user's key ---
    for (const [tmdbId, items] of seriesMap.entries()) {
      // Safety limit: if nearing 45 seconds, break early to allow clean finish
      if (Date.now() - startTime > 45000) {
        console.warn("Cron time budget reached, concluding current batch.");
        break;
      }

      processedSeriesCount++;

      // Try finding a valid decrypted TMDB key from opted-in users
      let tmdbKey: string | null = null;
      for (const item of items) {
        tmdbKey = await KeyService.getDecryptedKey(item.userId, "tmdb");
        if (tmdbKey) break;
      }

      if (!tmdbKey) {
        continue;
      }

      try {
        const details = await TmdbService.getTitleDetails(tmdbId, "tv", tmdbKey);
        const lastAired = details.lastEpisodeToAir;

        if (!lastAired || !lastAired.airDate) {
          continue;
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        // Only consider episodes that have aired on or before today
        if (lastAired.airDate > todayStr) {
          continue;
        }

        for (const item of items) {
          const lastSeen = item.lastSeenAiredEpisode;
          const lastSeenSeason = lastSeen?.seasonNumber ?? lastSeen?.season ?? 0;
          const lastSeenEpisode = lastSeen?.episodeNumber ?? lastSeen?.episode ?? 0;

          const isNewerEpisode =
            !lastSeen ||
            lastAired.seasonNumber > lastSeenSeason ||
            (lastAired.seasonNumber === lastSeenSeason &&
              lastAired.episodeNumber > lastSeenEpisode);

          if (isNewerEpisode) {
            newEpisodesDetected++;

            // Update tracked item: update lastSeenAiredEpisode and transition status
            const updateFields: Record<string, unknown> = {
              lastSeenAiredEpisode: {
                seasonNumber: lastAired.seasonNumber,
                episodeNumber: lastAired.episodeNumber,
                season: lastAired.seasonNumber,
                episode: lastAired.episodeNumber,
                airDate: lastAired.airDate,
              },
              updatedAt: new Date(),
            };

            // If series was previously marked "watched", move it back to "currently_watching"
            if (item.status === "watched") {
              updateFields.status = "currently_watching";
            }

            await db.collection("tracked_items").updateOne(
              { _id: item._id },
              { $set: updateFields }
            );

            // Create in-app notification
            const seriesTitle = item.minimalSnapshot?.title || details.title;
            await NotificationService.createInAppNotification({
              userId: item.userId,
              title: `New Episode: ${seriesTitle}`,
              message: `Season ${lastAired.seasonNumber}, Episode ${lastAired.episodeNumber} "${lastAired.name || ""}" is now available.`,
              link: `/title/tv/${tmdbId}`,
              type: "new_episode",
            });

            // Queue for combined daily push
            const userIdStr = item.userId.toHexString();
            const queue = userUpdatesQueue.get(userIdStr) || [];
            queue.push({
              seriesTitle,
              seasonNumber: lastAired.seasonNumber,
              episodeNumber: lastAired.episodeNumber,
              airDate: lastAired.airDate,
              tmdbId,
            });
            userUpdatesQueue.set(userIdStr, queue);
          }
        }
      } catch (err) {
        console.warn(`Failed to inspect series ${tmdbId} during cron:`, err);
      }
    }

    // --- Step 3: Dispatch ONE combined push notification per user ---
    let pushesSent = 0;
    const appBaseUrl = getAppUrl();

    for (const [userIdStr, episodes] of userUpdatesQueue.entries()) {
      if (episodes.length === 0) continue;

      const user = await db.collection<UserDocument>("users").findOne({
        _id: new ObjectId(userIdStr),
      });

      if (!user) continue;

      const title =
        episodes.length === 1
          ? `New Episode: ${episodes[0].seriesTitle}`
          : `${episodes.length} New Episodes Aired Today`;

      const lines = episodes
        .slice(0, 5)
        .map((ep) => `• ${ep.seriesTitle} S${ep.seasonNumber}E${ep.episodeNumber}`)
        .join("\n");

      const message =
        episodes.length > 5 ? `${lines}\n...and ${episodes.length - 5} more.` : lines;

      const clickUrl =
        episodes.length === 1
          ? `${appBaseUrl}/title/tv/${episodes[0].tmdbId}`
          : `${appBaseUrl}/notifications`;

      const res = await NotificationService.sendPush({
        topic: user.ntfyTopic,
        barkKey: user.barkKey,
        title,
        message,
        clickUrl,
      });

      if (res.ntfySent || res.barkSent) {
        pushesSent++;
      }
    }

    // --- Step 4: Maintenance Cleanups ---
    const now = new Date();

    // 1. Delete unverified accounts older than 7 days, along with their data
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleUserIds = await db
      .collection<UserDocument>("users")
      .find({ isVerified: false, createdAt: { $lt: sevenDaysAgo } }, { projection: { _id: 1 } })
      .map((u) => u._id!)
      .toArray();
    const unverifiedUsersResult = await db.collection("users").deleteMany({ _id: { $in: staleUserIds } });
    await Promise.all([
      db.collection("sessions").deleteMany({ userId: { $in: staleUserIds } }),
      db.collection("tracked_items").deleteMany({ userId: { $in: staleUserIds } }),
      db.collection("notifications").deleteMany({ userId: { $in: staleUserIds } }),
    ]);

    // 2. Delete read notifications older than 30 days
    const oldNotificationsDeleted = await NotificationService.cleanupOldNotifications(30);

    // 3. Delete expired sessions
    const expiredSessionsResult = await db.collection("sessions").deleteMany({
      expiresAt: { $lt: now },
    });

    // 4. Delete expired verification / password reset tokens
    const expiredTokensResult = await db.collection("tokens").deleteMany({
      expiresAt: { $lt: now },
    });

    // 5. Ensure indexes exist (idempotent; kept out of the request path)
    await ensureIndexes(db);

    const executionTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        executionTimeMs,
        uniqueSeriesChecked: seriesMap.size,
        processedSeriesCount,
        newEpisodesDetected,
        pushesSent,
        cleanups: {
          unverifiedAccountsRemoved: unverifiedUsersResult.deletedCount,
          readNotificationsRemoved: oldNotificationsDeleted,
          expiredSessionsRemoved: expiredSessionsResult.deletedCount,
          expiredTokensRemoved: expiredTokensResult.deletedCount,
        },
      },
    });
  } catch (error) {
    console.error("Daily cron job failed:", error);
    const message = error instanceof Error ? error.message : "Daily cron job encountered an error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
