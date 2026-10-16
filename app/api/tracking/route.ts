import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { WatchStatus, MediaType } from "@/lib/models/types";

const AddTitleSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  title: z.string().min(1),
  posterPath: z.string().nullable().optional(),
  yearRange: z.string().optional().default(""),
  notify: z.boolean().optional(),
});

/**
 * GET /api/tracking
 * Fetches user's tracked library by status or all.
 * Query params: ?status=want_to_watch|currently_watching|watched&mediaType=movie|tv
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as WatchStatus | null;
    const mediaTypeParam = searchParams.get("mediaType") as MediaType | null;

    if (statusParam && ["want_to_watch", "currently_watching", "watched"].includes(statusParam)) {
      const items = await TrackingService.getUserList({
        userId: session.user.id,
        status: statusParam,
        includeOverrides: searchParams.get("includeOverrides") === "true",
      });

      const filtered = mediaTypeParam
        ? items.filter((item) => item.mediaType === mediaTypeParam)
        : items;

      return NextResponse.json({
        success: true,
        data: { items: filtered },
      });
    }

    // Otherwise fetch all items across statuses
    const [wantToWatch, currentlyWatching, watched] = await Promise.all([
      TrackingService.getUserList({ userId: session.user.id, status: "want_to_watch" }),
      TrackingService.getUserList({ userId: session.user.id, status: "currently_watching", includeOverrides: true }),
      TrackingService.getUserList({ userId: session.user.id, status: "watched" }),
    ]);

    let allItems = [...wantToWatch, ...currentlyWatching, ...watched];
    if (mediaTypeParam) {
      allItems = allItems.filter((item) => item.mediaType === mediaTypeParam);
    }

    return NextResponse.json({
      success: true,
      data: {
        items: allItems,
        counts: {
          wantToWatch: wantToWatch.length,
          currentlyWatching: currentlyWatching.length,
          watched: watched.length,
          total: allItems.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch library";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * POST /api/tracking
 * Adds a new title to user's library (defaults to want_to_watch).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = AddTitleSchema.parse(body);

    const tracked = await TrackingService.addTitle({
      userId: session.user.id,
      tmdbId: parsed.tmdbId,
      mediaType: parsed.mediaType,
      snapshot: {
        tmdbId: parsed.tmdbId,
        mediaType: parsed.mediaType,
        title: parsed.title,
        posterPath: parsed.posterPath || null,
        yearRange: parsed.yearRange,
      },
      notify: parsed.notify ?? (parsed.mediaType === "tv"),
    });

    return NextResponse.json({
      success: true,
      data: { tracked },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to add title";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * DELETE /api/tracking
 * Removes a tracked title from user's library.
 * Query params: ?tmdbId=...&mediaType=movie|tv
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const { searchParams } = new URL(req.url);
    const tmdbId = parseInt(searchParams.get("tmdbId") || "0", 10);
    const mediaType = searchParams.get("mediaType") as MediaType | null;

    if (!tmdbId || !mediaType || !["movie", "tv"].includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid tmdbId or mediaType" },
        { status: 400 }
      );
    }

    await TrackingService.removeTitle(session.user.id, tmdbId, mediaType);

    return NextResponse.json({
      success: true,
      message: "Title removed from your collection",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove title";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
