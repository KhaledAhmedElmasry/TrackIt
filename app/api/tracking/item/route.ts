import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { MediaType } from "@/lib/models/types";

/**
 * GET /api/tracking/item?tmdbId=...&mediaType=movie|tv
 * Retrieves user's tracking state for a specific title.
 */
export async function GET(req: NextRequest) {
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
        { success: false, error: "Invalid tmdbId or mediaType" },
        { status: 400 }
      );
    }

    const item = await TrackingService.getTrackedItem(session.user.id, tmdbId, mediaType);

    return NextResponse.json({
      success: true,
      data: { item },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch item tracking state";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
