import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { KeyService } from "@/lib/services/key.service";
import { GeminiService } from "@/lib/services/gemini.service";
import { UnauthorizedError, ValidationError, ExternalServiceError } from "@/lib/errors/app-error";

/**
 * GET /api/recommendations
 * Retrieves previously generated recommendations and lastUpdated timestamp.
 */
export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const tmdbKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    const geminiKey = await KeyService.getDecryptedKey(session.user.id, "gemini");

    if (!tmdbKey) {
      return NextResponse.json(
        { success: false, error: "TMDB API key is required", code: "MISSING_TMDB_KEY" },
        { status: 400 }
      );
    }

    if (!geminiKey) {
      return NextResponse.json(
        { success: false, error: "Google Gemini API key is required", code: "MISSING_GEMINI_KEY" },
        { status: 400 }
      );
    }

    const result = await GeminiService.getRecommendations({
      userId: session.user.id,
      geminiKey,
      tmdbKey,
      forceRefresh: false,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to load recommendations";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * POST /api/recommendations
 * Triggers a fresh recommendation run with Gemini AI.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;

    const tmdbKey = await KeyService.getDecryptedKey(session.user.id, "tmdb");
    const geminiKey = await KeyService.getDecryptedKey(session.user.id, "gemini");

    if (!tmdbKey) {
      return NextResponse.json(
        { success: false, error: "Please configure your TMDB API key in Settings first.", code: "MISSING_TMDB_KEY" },
        { status: 400 }
      );
    }

    if (!geminiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Please configure your free Google Gemini API key in Settings first.",
          code: "MISSING_GEMINI_KEY",
        },
        { status: 400 }
      );
    }

    const result = await GeminiService.getRecommendations({
      userId: session.user.id,
      geminiKey,
      tmdbKey,
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof ExternalServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Recommendation generation failed";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
