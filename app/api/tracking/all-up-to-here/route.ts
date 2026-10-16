import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const MarkAllUpToHereSchema = z.object({
  tmdbId: z.number().int().positive(),
  targetSeason: z.number().int().positive(),
  targetEpisode: z.number().int().positive(),
  seasonEpisodeCounts: z.record(z.string(), z.number()),
  totalAiredSeriesEpisodes: z.number().int().min(0).default(0),
});

/**
 * POST /api/tracking/all-up-to-here
 * Marks all episodes from S01E01 up to targetSeason & targetEpisode as watched.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = MarkAllUpToHereSchema.parse(body);

    // Convert string keys to numbers for seasonEpisodeCounts
    const countsMap: Record<number, number> = {};
    for (const [key, value] of Object.entries(parsed.seasonEpisodeCounts)) {
      countsMap[parseInt(key, 10)] = value;
    }

    const updated = await TrackingService.markAllUpToHere({
      userId: session.user.id,
      tmdbId: parsed.tmdbId,
      targetSeason: parsed.targetSeason,
      targetEpisode: parsed.targetEpisode,
      seasonEpisodeCounts: countsMap,
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
    const message = error instanceof Error ? error.message : "Failed to mark episodes";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
