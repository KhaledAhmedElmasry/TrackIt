import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const EpisodeToggleSchema = z.object({
  tmdbId: z.number().int().positive(),
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().positive(),
  totalAiredEpisodes: z.number().int().min(0).default(0),
});

/**
 * POST /api/tracking/episode
 * Toggles an episode's watched status using compact range interval math.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = EpisodeToggleSchema.parse(body);

    const updated = await TrackingService.toggleEpisode({
      userId: session.user.id,
      tmdbId: parsed.tmdbId,
      seasonNumber: parsed.seasonNumber,
      episodeNumber: parsed.episodeNumber,
      totalAiredEpisodes: parsed.totalAiredEpisodes,
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
    const message = error instanceof Error ? error.message : "Failed to toggle episode";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

