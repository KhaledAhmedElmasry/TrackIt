import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";
import { handleApiError, AuthenticationError, ValidationError } from "@/lib/errors/app-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Sign in required");
    }

    const { searchParams } = new URL(req.url);
    const tvId = parseInt(searchParams.get("tvId") || "", 10);
    const seasonNumber = parseInt(searchParams.get("season") || "1", 10);

    if (isNaN(tvId) || isNaN(seasonNumber)) {
      throw new ValidationError("Valid tvId and season number are required");
    }

    const apiKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    if (!apiKey) {
      throw new ValidationError("Connect your TMDB key in Settings first");
    }

    const seasonDetail = await TmdbService.getSeasonEpisodes(tvId, seasonNumber, apiKey);

    return NextResponse.json({
      success: true,
      data: seasonDetail,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

