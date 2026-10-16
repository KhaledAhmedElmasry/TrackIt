/**
 * Tracking & Status Derivation Service
 *
 * Implements the core business logic of WatchTrack:
 * - Pure compact numerical range algorithms for episode tracking ([start, end] contiguous intervals).
 * - Automatic status derivation:
 *   - No episodes watched -> "want_to_watch"
 *   - Some but not all AIRED episodes watched -> "currently_watching"
 *   - All AIRED episodes watched -> "watched"
 *   - Unaired episodes and Season 0 specials do NOT count toward totals.
 *   - Movies: Watched or Want to Watch.
 * - Recomputes and indexes status on every write.
 * - Handles manual "dropped" and "on_hold" overrides.
 * - 1-5 star ratings.
 * - User isolation: all queries scoped strictly by userId.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import {
  TrackedItemDocument,
  WatchStatus,
  StatusOverride,
  MediaType,
  SeasonWatchRange,
  MinimalSnapshot,
} from "../models/types";
import { NotFoundError, ValidationError } from "../errors/app-error";

export * from "../utils/ranges";
import {
  isEpisodeInRange,
  addEpisodeToRanges,
  addRangeToIntervals,
  removeEpisodeFromRanges,
  countTotalWatchedStandardEpisodes,
  deriveWatchStatus,
} from "../utils/ranges";

// --- Tracking Service Class ---

export class TrackingService {
  /**
   * Adds a title to the user's watchlist in "want_to_watch" status.
   * Idempotent: Does not duplicate if already tracked.
   */
  static async addTitle(params: {
    userId: string | ObjectId;
    tmdbId: number;
    mediaType: MediaType;
    snapshot: MinimalSnapshot;
    notify?: boolean;
  }): Promise<TrackedItemDocument> {
    const { userId, tmdbId, mediaType, snapshot, notify = false } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    const now = new Date();
    const docToInsert: Omit<TrackedItemDocument, "_id"> = {
      userId: userObjectId,
      tmdbId,
      mediaType,
      status: "want_to_watch",
      override: null,
      rating: null,
      notify: notify,
      minimalSnapshot: snapshot,
      lastSeenAiredEpisode: null,
      watchedEpisodes: [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await collection.findOneAndUpdate(
      {
        userId: userObjectId,
        tmdbId,
        mediaType,
      },
      {
        $setOnInsert: docToInsert,
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    return result as TrackedItemDocument;
  }

  /**
   * Toggles an individual episode's watched state and updates derived status.
   */
  static async toggleEpisode(params: {
    userId: string | ObjectId;
    tmdbId: number;
    seasonNumber: number;
    episodeNumber: number;
    totalAiredEpisodes: number;
  }): Promise<TrackedItemDocument> {
    const { userId, tmdbId, seasonNumber, episodeNumber, totalAiredEpisodes } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    const item = await collection.findOne({
      userId: userObjectId,
      tmdbId,
      mediaType: "tv",
    });

    if (!item) {
      throw new NotFoundError("Tracked series not found. Please add to your list first.");
    }

    let seasons = [...(item.watchedEpisodes || [])];
    let seasonEntry = seasons.find((s) => s.season === seasonNumber);

    if (!seasonEntry) {
      seasonEntry = { season: seasonNumber, ranges: [] };
      seasons.push(seasonEntry);
    }

    const isWatched = isEpisodeInRange(seasonEntry.ranges, episodeNumber);

    if (isWatched) {
      seasonEntry.ranges = removeEpisodeFromRanges(seasonEntry.ranges, episodeNumber);
    } else {
      seasonEntry.ranges = addEpisodeToRanges(seasonEntry.ranges, episodeNumber);
    }

    // Clean up empty seasons
    seasons = seasons.filter((s) => s.ranges.length > 0);

    const watchedCount = countTotalWatchedStandardEpisodes(seasons);
    const newStatus = deriveWatchStatus({
      mediaType: "tv",
      watchedCount,
      totalAiredCount: totalAiredEpisodes,
    });

    // Auto notify rule: Default ON for currently_watching, OFF for want_to_watch / watched
    let notify = item.notify;
    if (newStatus === "currently_watching" && item.status === "want_to_watch") {
      notify = true;
    }

    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          watchedEpisodes: seasons,
          status: newStatus,
          notify,
          updatedAt: new Date(),
        },
      }
    );

    return (await collection.findOne({ _id: item._id }))!;
  }

  /**
   * Marks an entire season as watched (up to maxAiredEpisode).
   */
  static async markSeasonWatched(params: {
    userId: string | ObjectId;
    tmdbId: number;
    seasonNumber: number;
    maxAiredEpisode: number;
    totalAiredSeriesEpisodes: number;
  }): Promise<TrackedItemDocument> {
    const { userId, tmdbId, seasonNumber, maxAiredEpisode, totalAiredSeriesEpisodes } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    const item = await collection.findOne({
      userId: userObjectId,
      tmdbId,
      mediaType: "tv",
    });

    if (!item) {
      throw new NotFoundError("Tracked series not found.");
    }

    const seasons = [...(item.watchedEpisodes || [])];
    let seasonEntry = seasons.find((s) => s.season === seasonNumber);

    if (!seasonEntry) {
      seasonEntry = { season: seasonNumber, ranges: [] };
      seasons.push(seasonEntry);
    }

    seasonEntry.ranges = addRangeToIntervals(seasonEntry.ranges, 1, maxAiredEpisode);

    const watchedCount = countTotalWatchedStandardEpisodes(seasons);
    const newStatus = deriveWatchStatus({
      mediaType: "tv",
      watchedCount,
      totalAiredCount: totalAiredSeriesEpisodes,
    });

    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          watchedEpisodes: seasons,
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    return (await collection.findOne({ _id: item._id }))!;
  }

  /**
   * "Mark all up to here": Marks all episodes from Season 1 Episode 1 up to target Season & Episode.
   */
  static async markAllUpToHere(params: {
    userId: string | ObjectId;
    tmdbId: number;
    targetSeason: number;
    targetEpisode: number;
    seasonEpisodeCounts: Record<number, number>; // season -> total episodes in that season
    totalAiredSeriesEpisodes: number;
  }): Promise<TrackedItemDocument> {
    const {
      userId,
      tmdbId,
      targetSeason,
      targetEpisode,
      seasonEpisodeCounts,
      totalAiredSeriesEpisodes,
    } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    const item = await collection.findOne({
      userId: userObjectId,
      tmdbId,
      mediaType: "tv",
    });

    if (!item) {
      throw new NotFoundError("Tracked series not found.");
    }

    const seasonsMap = new Map<number, [number, number][]>();
    for (const s of item.watchedEpisodes || []) {
      seasonsMap.set(s.season, [...s.ranges]);
    }

    // Mark previous seasons completely
    for (let s = 1; s < targetSeason; s++) {
      const maxEp = seasonEpisodeCounts[s] || 1;
      seasonsMap.set(s, addRangeToIntervals(seasonsMap.get(s) || [], 1, maxEp));
    }

    // Mark target season up to targetEpisode
    seasonsMap.set(
      targetSeason,
      addRangeToIntervals(seasonsMap.get(targetSeason) || [], 1, targetEpisode)
    );

    const newSeasons: SeasonWatchRange[] = [];
    for (const [season, ranges] of seasonsMap.entries()) {
      newSeasons.push({ season, ranges });
    }

    const watchedCount = countTotalWatchedStandardEpisodes(newSeasons);
    const newStatus = deriveWatchStatus({
      mediaType: "tv",
      watchedCount,
      totalAiredCount: totalAiredSeriesEpisodes,
    });

    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          watchedEpisodes: newSeasons,
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    return (await collection.findOne({ _id: item._id }))!;
  }

  /**
   * Toggles movie watched status.
   */
  static async toggleMovieWatched(
    userId: string | ObjectId,
    tmdbId: number
  ): Promise<TrackedItemDocument> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    const item = await collection.findOne({
      userId: userObjectId,
      tmdbId,
      mediaType: "movie",
    });

    if (!item) {
      throw new NotFoundError("Movie not found in your watchlist.");
    }

    const isCurrentlyWatched = item.status === "watched";
    const newStatus: WatchStatus = isCurrentlyWatched ? "want_to_watch" : "watched";

    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }
    );

    return (await collection.findOne({ _id: item._id }))!;
  }

  /**
   * Sets or clears a 1-5 star rating.
   */
  static async setRating(
    userId: string | ObjectId,
    tmdbId: number,
    mediaType: MediaType,
    rating: number | null
  ): Promise<void> {
    if (rating !== null && (rating < 1 || rating > 5)) {
      throw new ValidationError("Rating must be an integer between 1 and 5 stars");
    }

    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    await db.collection("tracked_items").updateOne(
      { userId: userObjectId, tmdbId, mediaType },
      {
        $set: { rating, updatedAt: new Date() },
      }
    );
  }

  /**
   * Toggles the "notify" push notification flag for a series.
   */
  static async setNotify(
    userId: string | ObjectId,
    tmdbId: number,
    mediaType: MediaType,
    notify: boolean
  ): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    await db.collection("tracked_items").updateOne(
      { userId: userObjectId, tmdbId, mediaType },
      {
        $set: { notify, updatedAt: new Date() },
      }
    );
  }

  /**
   * Sets a manual status override ("dropped" | "on_hold" | null).
   */
  static async setOverride(
    userId: string | ObjectId,
    tmdbId: number,
    mediaType: MediaType,
    override: StatusOverride
  ): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    await db.collection("tracked_items").updateOne(
      { userId: userObjectId, tmdbId, mediaType },
      {
        $set: { override, updatedAt: new Date() },
      }
    );
  }

  /**
   * Removes a title completely from the user's tracked collection.
   */
  static async removeTitle(
    userId: string | ObjectId,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    await db.collection("tracked_items").deleteOne({ userId: userObjectId, tmdbId, mediaType });
  }

  /**
   * Fetches the user's tracked lists by status (want_to_watch, currently_watching, watched).
   * Respects "dropped" / "on_hold" overrides by hiding them from currently_watching.
   */
  static async getUserList(params: {
    userId: string | ObjectId;
    status: WatchStatus;
    includeOverrides?: boolean;
  }): Promise<TrackedItemDocument[]> {
    const { userId, status, includeOverrides = false } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
      userId: userObjectId,
      status,
    };

    if (status === "currently_watching" && !includeOverrides) {
      // Hide dropped or on_hold series from active watching list
      query.override = { $in: [null, undefined] };
    }

    return db
      .collection<TrackedItemDocument>("tracked_items")
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Returns a single tracked item document for a user.
   */
  static async getTrackedItem(
    userId: string | ObjectId,
    tmdbId: number,
    mediaType: MediaType
  ): Promise<TrackedItemDocument | null> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    return db.collection<TrackedItemDocument>("tracked_items").findOne({
      userId: userObjectId,
      tmdbId,
      mediaType,
    });
  }

  /**
   * Returns next unwatched episode per currently watching series for the "Continue Watching" row.
   */
  static async getContinueWatchingRow(
    userId: string | ObjectId
  ): Promise<Array<{ item: TrackedItemDocument; nextEpisode: { season: number; episode: number } }>> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    const activeSeries = await db
      .collection<TrackedItemDocument>("tracked_items")
      .find({
        userId: userObjectId,
        mediaType: "tv",
        status: "currently_watching",
        override: { $in: [null, undefined] },
      })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray();

    const results: Array<{
      item: TrackedItemDocument;
      nextEpisode: { season: number; episode: number };
    }> = [];

    for (const item of activeSeries) {
      const watched = item.watchedEpisodes || [];
      // Find highest season and episode watched
      let highestSeason = 1;
      let highestEp = 0;

      for (const s of watched) {
        if (s.season > 0 && s.ranges.length > 0) {
          const maxInSeason = Math.max(...s.ranges.map((r) => r[1]));
          if (s.season > highestSeason || (s.season === highestSeason && maxInSeason > highestEp)) {
            highestSeason = s.season;
            highestEp = maxInSeason;
          }
        }
      }

      results.push({
        item,
        nextEpisode: {
          season: highestSeason,
          episode: highestEp + 1,
        },
      });
    }

    return results;
  }
}
