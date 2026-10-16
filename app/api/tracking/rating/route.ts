import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const RatingSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  rating: z.number().int().min(1).max(5).nullable(),
});

/**
 * POST /api/tracking/rating
 * Sets or clears a 1-5 star rating.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = RatingSchema.parse(body);

    await TrackingService.setRating(
      session.user.id,
      parsed.tmdbId,
      parsed.mediaType,
      parsed.rating
    );

    return NextResponse.json({
      success: true,
      message: parsed.rating ? `Rating set to ${parsed.rating} stars` : "Rating cleared",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to set rating";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
