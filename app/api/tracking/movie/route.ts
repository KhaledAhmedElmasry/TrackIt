import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const MovieToggleSchema = z.object({
  tmdbId: z.number().int().positive(),
});

/**
 * POST /api/tracking/movie
 * Toggles movie watched / want_to_watch status.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = MovieToggleSchema.parse(body);

    const updated = await TrackingService.toggleMovieWatched(session.user.id, parsed.tmdbId);

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
    const message = error instanceof Error ? error.message : "Failed to toggle movie";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
