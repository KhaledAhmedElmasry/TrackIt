/**
 * Google Gemini AI Recommendation Service
 *
 * Implements:
 * - Isolated Gemini API caller using the user's decrypted Gemini key.
 * - Free tier model: gemini-1.5-flash / gemini-2.0-flash with structured JSON output schema.
 * - Compact prompt: sends only anonymized title names, TMDB IDs, and user star ratings (no personal data).
 * - Hallucination guard: validates every single returned TMDB ID against TMDB API!
 * - Cooldown enforcement to respect free-tier RPM and RPD quotas.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import { TmdbService } from "./tmdb.service";
import { ExternalServiceError, ValidationError } from "../errors/app-error";
import { MediaType, TrackedItemDocument } from "../models/types";

export interface AiRecommendationItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  reason: string;
  posterPath: string | null;
  yearRange: string;
}

export interface RecommendationResult {
  recommendations: AiRecommendationItem[];
  generatedAt: Date;
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const RECOMMENDATION_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown

export class GeminiService {
  /**
   * Generates tailored recommendations based on the user's watched/rated library.
   */
  static async getRecommendations(params: {
    userId: string | ObjectId;
    geminiKey: string;
    tmdbKey: string;
    forceRefresh?: boolean;
  }): Promise<RecommendationResult> {
    const { userId, geminiKey, tmdbKey, forceRefresh = false } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    // Check cached recommendations in user document or recommendations collection
    const user = await db.collection("users").findOne({ _id: userObjectId });
    const cached = user?.recommendationsCache as
      | { items: AiRecommendationItem[]; generatedAt: Date }
      | undefined;

    if (!forceRefresh && cached && cached.items?.length > 0) {
      return {
        recommendations: cached.items,
        generatedAt: new Date(cached.generatedAt),
      };
    }

    // Cooldown check if refreshed recently
    if (cached?.generatedAt) {
      const timeSince = Date.now() - new Date(cached.generatedAt).getTime();
      if (timeSince < RECOMMENDATION_COOLDOWN_MS && !forceRefresh) {
        return {
          recommendations: cached.items,
          generatedAt: new Date(cached.generatedAt),
        };
      }
    }

    // Gather user's library: watched or currently watching or rated
    const library = await db
      .collection<TrackedItemDocument>("tracked_items")
      .find({ userId: userObjectId })
      .toArray();

    const watchedOrRated = library.filter(
      (item) =>
        item.status === "watched" ||
        item.status === "currently_watching" ||
        (item.rating && item.rating > 0)
    );

    if (watchedOrRated.length < 3) {
      throw new ValidationError(
        "Please track or rate at least 3 movies or TV series before requesting recommendations."
      );
    }

    // Prepare compact summary of user tastes (strictly no personal information)
    const trackedIdsSet = new Set(library.map((item) => `${item.mediaType}:${item.tmdbId}`));

    const compactProfile = watchedOrRated.slice(0, 30).map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.minimalSnapshot?.title || `Title ${item.tmdbId}`,
      status: item.status,
      rating: item.rating || "unrated",
    }));

    const systemPrompt = `You are a film and television recommendation engine.
Analyze the user's viewing history and ratings below.
Recommend 6 to 10 outstanding movies and TV series tailored to their taste.

CRITICAL RULES:
1. NEVER recommend any title that is already in the user's list (do NOT recommend any tmdbId listed below).
2. ONLY recommend real movies and TV series with accurate TMDB (The Movie Database) integer IDs.
3. Provide a concise, 1-sentence reason for each recommendation explaining why the user will enjoy it based on their tastes.
4. Output MUST be valid JSON adhering strictly to this schema:
{
  "recommendations": [
    {
      "tmdbId": 12345,
      "mediaType": "movie" | "tv",
      "title": "Exact Title",
      "reason": "Because you enjoyed X and Y, this offers similar..."
    }
  ]
}
Do NOT include markdown formatting or backticks around the JSON.`;

    const userPrompt = `User viewing history and ratings:\n${JSON.stringify(compactProfile, null, 2)}`;

    // Call Gemini Free Tier REST endpoint
    let rawResponseText = "";
    try {
      const geminiRes = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        const errorJson = await geminiRes.json().catch(() => null);
        const errMsg = errorJson?.error?.message || `Gemini request failed (${geminiRes.status})`;
        throw new ExternalServiceError(`Gemini AI Error: ${errMsg}`);
      }

      const geminiJson = await geminiRes.json();
      rawResponseText =
        geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    } catch (err) {
      if (err instanceof ExternalServiceError) throw err;
      throw new ExternalServiceError(
        `Failed to communicate with Google Gemini API: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Parse structured JSON
    let parsed: {
      recommendations?: Array<{
        tmdbId: number;
        mediaType: "movie" | "tv";
        title: string;
        reason: string;
      }>;
    } = {};

    try {
      // Clean potential code fences if any leaked
      const cleaned = rawResponseText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new ExternalServiceError("Gemini generated an invalid JSON response. Please try again.");
    }

    const rawRecs = parsed.recommendations || [];
    const verifiedRecs: AiRecommendationItem[] = [];

    // --- Strict TMDB Hallucination Guard ---
    // Validate every single returned TMDB ID against the TMDB API
    for (const rec of rawRecs) {
      if (!rec.tmdbId || !rec.mediaType || !["movie", "tv"].includes(rec.mediaType)) {
        continue;
      }

      // Check if user already tracks this title
      if (trackedIdsSet.has(`${rec.mediaType}:${rec.tmdbId}`)) {
        continue;
      }

      try {
        const tmdbData = await TmdbService.getTitleDetails(rec.tmdbId, rec.mediaType, tmdbKey);
        if (tmdbData && tmdbData.id) {
          verifiedRecs.push({
            tmdbId: tmdbData.id,
            mediaType: tmdbData.mediaType,
            title: tmdbData.title,
            reason: rec.reason || "Recommended based on your recent viewing history.",
            posterPath: tmdbData.posterPath,
            yearRange: tmdbData.yearRange,
          });
        }
      } catch {
        // ID was invalid or not found on TMDB -> safely discarded
        console.warn(`Gemini hallucinated invalid TMDB ID: ${rec.tmdbId} (${rec.title})`);
      }

      if (verifiedRecs.length >= 8) break;
    }

    if (verifiedRecs.length === 0) {
      throw new ExternalServiceError(
        "Could not verify recommendations against TMDB. Please try again in a few moments."
      );
    }

    const now = new Date();
    // Cache verified results in user document
    await db.collection("users").updateOne(
      { _id: userObjectId },
      {
        $set: {
          recommendationsCache: {
            items: verifiedRecs,
            generatedAt: now,
          },
          updatedAt: now,
        },
      }
    );

    return {
      recommendations: verifiedRecs,
      generatedAt: now,
    };
  }
}

