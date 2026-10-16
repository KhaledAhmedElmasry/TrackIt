import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";

const BulkAddSchema = z.object({
  items: z.array(
    z.object({
      tmdbId: z.number().int().positive(),
      mediaType: z.enum(["movie", "tv"]),
      title: z.string().min(1),
      posterPath: z.string().nullable().optional(),
      yearRange: z.string().optional().default(""),
      status: z.enum(["want_to_watch", "watched"]).optional(),
    })
  ).min(1),
});

const CollectionWatchedSchema = z.object({
  collectionId: z.number().int().positive(),
});

/**
 * POST /api/tracking/bulk
 * Supports:
 * 1) action: "add_items" - bulk adds multiple items to watchlist
 * 2) action: "collection_watched" - fetches all parts in a collection and marks each movie as watched
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const action = body.action || "add_items";

    if (action === "add_items") {
      const parsed = BulkAddSchema.parse(body);
      const added: unknown[] = [];

      for (const item of parsed.items) {
        const doc = await TrackingService.addTitle({
          userId: session.user.id,
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          snapshot: {
            tmdbId: item.tmdbId,
            mediaType: item.mediaType,
            title: item.title,
            posterPath: item.posterPath || null,
            yearRange: item.yearRange,
          },
        });

        if (item.status === "watched" && item.mediaType === "movie") {
          const current = await TrackingService.getTrackedItem(session.user.id, item.tmdbId, "movie");
          if (current && current.status !== "watched") {
            await TrackingService.toggleMovieWatched(session.user.id, item.tmdbId);
          }
        }

        added.push(doc);
      }

      return NextResponse.json({
        success: true,
        data: { addedCount: added.length },
      });
    }

    if (action === "collection_watched") {
      const parsed = CollectionWatchedSchema.parse(body);

      // Decrypt TMDB key
      const tmdbKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
      if (!tmdbKey) {
        return NextResponse.json(
          { success: false, error: "TMDB API key required to load collection" },
          { status: 400 }
        );
      }

      const collection = await TmdbService.getCollection(parsed.collectionId, tmdbKey);
      let markedCount = 0;

      for (const part of collection.parts) {
        await TrackingService.addTitle({
          userId: session.user.id,
          tmdbId: part.id,
          mediaType: "movie",
          snapshot: {
            tmdbId: part.id,
            mediaType: "movie",
            title: part.title,
            posterPath: part.posterPath,
            yearRange: part.yearRange,
          },
        });

        const current = await TrackingService.getTrackedItem(session.user.id, part.id, "movie");
        if (current && current.status !== "watched") {
          await TrackingService.toggleMovieWatched(session.user.id, part.id);
        }
        markedCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Marked ${markedCount} movies from "${collection.name}" as watched`,
        data: { markedCount, collectionName: collection.name },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Bulk action failed";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
