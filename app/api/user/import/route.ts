import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongodb";
import { UnauthorizedError } from "@/lib/errors/app-error";
import {
  addRangeToIntervals,
  countTotalWatchedStandardEpisodes,
  deriveWatchStatus,
} from "@/lib/services/tracking.service";
import { TrackedItemDocument, SeasonWatchRange } from "@/lib/models/types";

const ImportItemSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  status: z.enum(["want_to_watch", "currently_watching", "watched"]),
  override: z.enum(["dropped", "on_hold"]).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notify: z.boolean().optional(),
  minimalSnapshot: z.object({
    tmdbId: z.number().int().positive(),
    mediaType: z.enum(["movie", "tv"]),
    title: z.string().min(1),
    posterPath: z.string().nullable().optional(),
    yearRange: z.string().optional().default(""),
  }),
  watchedEpisodes: z
    .array(
      z.object({
        season: z.number().int().min(0),
        ranges: z.array(z.tuple([z.number(), z.number()])),
      })
    )
    .optional(),
});

const ImportPayloadSchema = z.object({
  version: z.number().int().optional(),
  library: z.array(ImportItemSchema),
});

/**
 * POST /api/user/import
 * Imports and merges library data from a previously exported JSON backup.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = ImportPayloadSchema.parse(body);

    const db = await getDb();
    const userObjectId = new ObjectId(session.user.id);
    const collection = db.collection<TrackedItemDocument>("tracked_items");

    let createdCount = 0;
    let mergedCount = 0;

    for (const item of parsed.library) {
      const existing = await collection.findOne({
        userId: userObjectId,
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
      });

      if (!existing) {
        // Insert new item
        const newDoc: TrackedItemDocument = {
          userId: userObjectId,
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          status: item.status,
          override: item.override || null,
          rating: item.rating || null,
          notify: item.notify ?? (item.mediaType === "tv"),
          minimalSnapshot: {
            tmdbId: item.minimalSnapshot.tmdbId,
            mediaType: item.minimalSnapshot.mediaType,
            title: item.minimalSnapshot.title,
            posterPath: item.minimalSnapshot.posterPath || null,
            yearRange: item.minimalSnapshot.yearRange,
          },
          lastSeenAiredEpisode: null,
          watchedEpisodes: (item.watchedEpisodes as SeasonWatchRange[]) || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await collection.insertOne(newDoc);
        createdCount++;
      } else {
        // Merge existing item
        const mergedSeasons = [...(existing.watchedEpisodes || [])];

        if (item.watchedEpisodes && item.watchedEpisodes.length > 0) {
          for (const incomingSeason of item.watchedEpisodes) {
            let existingSeason = mergedSeasons.find((s) => s.season === incomingSeason.season);
            if (!existingSeason) {
              existingSeason = { season: incomingSeason.season, ranges: [] };
              mergedSeasons.push(existingSeason);
            }

            for (const [from, to] of incomingSeason.ranges) {
              existingSeason.ranges = addRangeToIntervals(existingSeason.ranges, from, to);
            }
          }
        }

        const watchedCount = countTotalWatchedStandardEpisodes(mergedSeasons);
        const derivedStatus =
          item.mediaType === "tv"
            ? deriveWatchStatus({
                mediaType: "tv",
                watchedCount,
                totalAiredCount: 0,
              })
            : existing.status === "watched" || item.status === "watched"
            ? "watched"
            : "want_to_watch";

        await collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              watchedEpisodes: mergedSeasons,
              status: derivedStatus,
              rating: item.rating !== undefined ? item.rating : existing.rating,
              override: item.override !== undefined ? item.override : existing.override,
              updatedAt: new Date(),
            },
          }
        );
        mergedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete: ${createdCount} items added, ${mergedCount} items merged.`,
      data: { createdCount, mergedCount, totalProcessed: parsed.library.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: `Invalid import file schema: ${error.issues[0]?.message}` },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Import failed";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
