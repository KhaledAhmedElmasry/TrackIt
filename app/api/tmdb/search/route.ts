import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { KeyService } from "@/lib/services/key.service";
import { TmdbService } from "@/lib/services/tmdb.service";
import { handleApiError, AuthenticationError, ValidationError } from "@/lib/errors/app-error";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Sign in to search movies and series");
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const filter = (searchParams.get("type") as "all" | "movie" | "tv") || "all";
    const page = parseInt(searchParams.get("page") || "1", 10);

    if (!query.trim()) {
      return NextResponse.json({ success: true, data: { results: [], totalResults: 0, totalPages: 0 } });
    }

    // Decrypt user's TMDB key server-side
    const apiKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    if (!apiKey) {
      throw new ValidationError(
        "Please connect your free TMDB API key in Settings to search and track titles."
      );
    }

    const searchData = await TmdbService.searchMulti(query, apiKey, filter, page);

    return NextResponse.json({
      success: true,
      data: searchData,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
