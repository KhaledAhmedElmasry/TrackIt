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
  predictedRating?: number; // Predicted likeness rating from 0.00 to 10.00
  posterPath: string | null;
  yearRange: string;
}

export interface RecommendationResult {
  recommendations: AiRecommendationItem[];
  generatedAt: Date;
}

const CANDIDATE_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];
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

    // Prepare compact summary of user tastes and habits (strictly no personal information)
    const trackedIdsSet = new Set(library.map((item) => `${item.mediaType}:${item.tmdbId}`));

    const totalMovies = library.filter((i) => i.mediaType === "movie" && i.status === "watched").length;
    const totalTv = library.filter((i) => i.mediaType === "tv").length;
    const ratedItems = library.filter((i) => typeof i.rating === "number" && i.rating > 0);
    const avgRating = ratedItems.length > 0
      ? (ratedItems.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedItems.length).toFixed(2)
      : "N/A";

    const userHabits = {
      watchedMoviesCount: totalMovies,
      trackedSeriesCount: totalTv,
      userAverageRatingScale0to10: avgRating,
      primaryFormatPreference: totalMovies > totalTv ? "movies" : "tv series",
    };

    const compactProfile = watchedOrRated.slice(0, 30).map((item) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.minimalSnapshot?.title || `Title ${item.tmdbId}`,
      status: item.status,
      rating: item.rating !== undefined && item.rating !== null ? `${item.rating}/10` : "unrated",
    }));

    const systemPrompt = `You are an expert film and television recommendation engine.
Analyze the user's viewing history, 0-10 decimal ratings, and watch habits below.
Recommend 6 to 10 outstanding movies and TV series tailored precisely to their likeness and taste.

CRITICAL RULES:
1. NEVER recommend any title that is already in the user's list (do NOT recommend any tmdbId listed below).
2. ONLY recommend real movies and TV series with accurate TMDB (The Movie Database) integer IDs.
3. Compute an expected predicted rating from 0.00 to 10.00 (e.g. 8.75 or 9.40) reflecting how much this user will like the title based on their watch habits and previous ratings.
4. Provide a concise, 1-sentence reason for each recommendation explicitly connecting it to their likeness and habits (e.g. "Given your 9.5/10 rating on X and preference for thrillers, this delivers...").
5. Output MUST be valid JSON adhering strictly to this schema:
{
  "recommendations": [
    {
      "tmdbId": 12345,
      "mediaType": "movie",
      "title": "Exact Title",
      "predictedRating": 9.25,
      "reason": "Because you rated X 9.5/10 and frequently watch sci-fi thrillers, this matches your taste..."
    }
  ]
}
Do NOT include markdown formatting or backticks around the JSON.`;

    const userPrompt = `User Watch Habits:\n${JSON.stringify(userHabits, null, 2)}\n\nUser Viewing History and 0-10 Ratings:\n${JSON.stringify(compactProfile, null, 2)}`;

    // Call Gemini Free Tier REST endpoint with automatic candidate fallback
    let rawResponseText = "";
    let lastError: Error | null = null;

    for (const modelName of CANDIDATE_GEMINI_MODELS) {
      try {
        // Key goes in a header, not the query string, so it never lands in request logs
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
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
          if (geminiRes.status === 404 || geminiRes.status === 503) {
            lastError = new ExternalServiceError(`Gemini AI (${modelName}): ${errMsg}`);
            if (geminiRes.status === 503) {
              await new Promise((r) => setTimeout(r, 600));
            }
            continue;
          }
          throw new ExternalServiceError(`Gemini AI Error: ${errMsg}`);
        }

        const geminiJson = await geminiRes.json();
        rawResponseText =
          geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        lastError = null;
        break;
      } catch (err) {
        if (err instanceof ExternalServiceError && (err.message.includes("404") || err.message.includes("503"))) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    if (!rawResponseText && lastError) {
      throw lastError;
    }

    // Parse structured JSON
    let parsed: {
      recommendations?: Array<{
        tmdbId: number;
        mediaType: "movie" | "tv";
        title: string;
        predictedRating?: number;
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
            reason: rec.reason || "Recommended based on your recent viewing history and habits.",
            predictedRating:
              typeof rec.predictedRating === "number" && !isNaN(rec.predictedRating)
                ? Math.min(10, Math.max(0, Math.round(rec.predictedRating * 100) / 100))
                : undefined,
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

