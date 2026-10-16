import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const SeasonWatchedSchema = z.object({
  tmdbId: z.number().int().positive(),
  seasonNumber: z.number().int().min(0),
  maxAiredEpisode: z.number().int().positive(),
  totalAiredSeriesEpisodes: z.number().int().min(0).default(0),
});

/**
 * POST /api/tracking/season
 * Marks an entire season watched up to maxAiredEpisode.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = SeasonWatchedSchema.parse(body);

    const updated = await TrackingService.markSeasonWatched({
      userId: session.user.id,
      tmdbId: parsed.tmdbId,
      seasonNumber: parsed.seasonNumber,
      maxAiredEpisode: parsed.maxAiredEpisode,
      totalAiredSeriesEpisodes: parsed.totalAiredSeriesEpisodes,
    });

    return NextResponse.json({
      success: true,
      data: { item: updated },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to mark season watched";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
