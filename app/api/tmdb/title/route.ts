import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";
import { TrackingService } from "@/lib/services/tracking.service";
import { handleApiError, AuthenticationError, ValidationError } from "@/lib/errors/app-error";
import { MediaType } from "@/lib/models/types";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Sign in required");
    }

    const { searchParams } = new URL(req.url);
    const tmdbIdStr = searchParams.get("id");
    const mediaType = searchParams.get("type") as MediaType;

    if (!tmdbIdStr || !mediaType || (mediaType !== "movie" && mediaType !== "tv")) {
      throw new ValidationError("Valid id and type (movie or tv) are required");
    }

    const tmdbId = parseInt(tmdbIdStr, 10);
    const apiKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    if (!apiKey) {
      throw new ValidationError("Connect your free TMDB key in Settings first");
    }

    // Fetch TMDB metadata (cached)
    const details = await TmdbService.getTitleDetails(tmdbId, mediaType, apiKey);

    // Fetch user's current tracked state if tracked
    const trackedItem = await TrackingService.getTrackedItem(session.user.id, tmdbId, mediaType);

    return NextResponse.json({
      success: true,
      data: {
        details,
        tracked: trackedItem || null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
