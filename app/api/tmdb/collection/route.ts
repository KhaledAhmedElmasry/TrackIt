import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";
import { getDb } from "@/lib/db/mongodb";
import { handleApiError, UnauthorizedError, ValidationError } from "@/lib/errors/app-error";
import { TrackedItemDocument } from "@/lib/models/types";

/**
 * GET /api/tmdb/collection?id={collectionId}
 * Fetches all movie parts belonging to a TMDB collection/franchise,
 * annotated with each item's watch status for the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const collectionId = parseInt(idParam || "", 10);

    if (isNaN(collectionId) || collectionId <= 0) {
      throw new ValidationError("A valid positive collection ID is required.");
    }

    const tmdbKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    if (!tmdbKey) {
      return NextResponse.json(
        {
          success: false,
          error: "TMDB API key is not configured. Please add your key in Settings.",
        },
        { status: 400 }
      );
    }

    const collection = await TmdbService.getCollection(collectionId, tmdbKey);
    const db = await getDb();
    const userObjectId = new ObjectId(session.user.id);

    // Fetch existing tracking states for all movies in this collection
    const partIds = collection.parts.map((p) => p.id);
    const trackedItems = await db
      .collection<TrackedItemDocument>("tracked_items")
      .find({
        userId: userObjectId,
        mediaType: "movie",
        tmdbId: { $in: partIds },
      })
      .toArray();

    const trackedMap = new Map(trackedItems.map((item) => [item.tmdbId, item]));

    const annotatedParts = collection.parts.map((part) => {
      const tracked = trackedMap.get(part.id);
      return {
        ...part,
        isWatched: tracked?.status === "watched",
        status: tracked?.status || null,
        trackedId: tracked?._id ? tracked._id.toHexString() : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: collection.id,
        name: collection.name,
        overview: collection.overview,
        posterPath: collection.posterPath,
        parts: annotatedParts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
