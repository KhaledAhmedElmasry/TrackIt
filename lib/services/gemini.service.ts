/**
 * Google Gemini AI Recommendation Service
 *
 * Implements:
 * - Isolated Gemini API caller using the user's decrypted Gemini key.
 * - Compact prompt: sends only title names, years, list status and the ratings the user
 *   actually gave (no personal data).
 * - Title guard: every pick is matched against TMDB by title and year, so a wrong or
 *   invented TMDB id can never surface an unrelated film.
 * - Honesty guard: reasons may only cite titles from the user's history and never quote a
 *   rating the user did not give; otherwise the reason is rebuilt from real data.
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

interface RawRecommendation {
  title?: string;
  year?: number;
  mediaType?: string;
  tmdbId?: number;
  predictedRating?: number;
  basedOn?: string[];
  reason?: string;
}

const CANDIDATE_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];
const RECOMMENDATION_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes cooldown
// Bump when the generation logic changes so stale cached picks are regenerated
const RECOMMENDATIONS_CACHE_VERSION = 2;
const MAX_RECOMMENDATIONS = 8;

/** Lowercase, strip accents, punctuation and a leading article, for title comparison. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesMatch(a: string, b: string): boolean {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return x.length > 0 && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
}

function yearOf(yearRange: string | undefined): number | null {
  const match = yearRange?.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

/**
 * True when every "N/10" rating quoted in the reason is one the user really gave,
 * attached to a title they really rated. Rating-free reasons always pass.
 */
export function reasonIsHonest(reason: string, ratedTitles: Array<{ title: string; rating: number }>): boolean {
  const claims = [...reason.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*10\b/g)].map((m) => Number(m[1]));
  if (claims.length === 0) return true;
  const normalizedReason = normalizeTitle(reason);
  return claims.every((value) =>
    ratedTitles.some((item) => item.rating === value && normalizedReason.includes(normalizeTitle(item.title)))
  );
}

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

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

    const user = await db.collection("users").findOne({ _id: userObjectId });
    const cached = user?.recommendationsCache as
      | { items: AiRecommendationItem[]; generatedAt: Date; version?: number }
      | undefined;
    const cacheIsCurrent = cached?.version === RECOMMENDATIONS_CACHE_VERSION && cached.items?.length > 0;

    if (!forceRefresh && cacheIsCurrent) {
      return { recommendations: cached.items, generatedAt: new Date(cached.generatedAt) };
    }

    // Cooldown applies to explicit refreshes too, to protect the free Gemini quota
    if (cacheIsCurrent && Date.now() - new Date(cached.generatedAt).getTime() < RECOMMENDATION_COOLDOWN_MS) {
      throw new ValidationError("New picks were made a moment ago. Try again in a couple of minutes.");
    }

    const library = await db
      .collection<TrackedItemDocument>("tracked_items")
      .find({ userId: userObjectId })
      .toArray();

    const isRated = (item: TrackedItemDocument) => typeof item.rating === "number";
    const history = library
      .filter((item) => item.status === "watched" || item.status === "currently_watching" || isRated(item))
      // Rated titles first (highest first), then the most recently updated
      .sort(
        (a, b) =>
          Number(isRated(b)) - Number(isRated(a)) ||
          (b.rating ?? 0) - (a.rating ?? 0) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

    if (history.length < 3) {
      throw new ValidationError(
        "Please track or rate at least 3 movies or TV series before requesting recommendations."
      );
    }

    const trackedIds = new Set(library.map((item) => `${item.mediaType}:${item.tmdbId}`));
    const trackedTitles = new Set(library.map((item) => normalizeTitle(item.minimalSnapshot?.title || "")));
    const ratedTitles = library
      .filter(isRated)
      .map((item) => ({ title: item.minimalSnapshot?.title || "", rating: item.rating as number }));
    const historyTitles = new Map(
      history.map((item) => [normalizeTitle(item.minimalSnapshot?.title || ""), item.minimalSnapshot?.title || ""])
    );

    const profile = history.slice(0, 40).map((item) => ({
      title: item.minimalSnapshot?.title || `Title ${item.tmdbId}`,
      year: yearOf(item.minimalSnapshot?.yearRange),
      type: item.mediaType === "movie" ? "film" : "series",
      status: item.status === "watched" ? "finished" : item.status === "currently_watching" ? "watching" : "saved",
      // Only ratings the user actually gave; null means the user never rated it
      userRating: isRated(item) ? item.rating : null,
    }));
    const otherTracked = library
      .filter((item) => !history.includes(item))
      .slice(0, 60)
      .map((item) => item.minimalSnapshot?.title)
      .filter(Boolean);

    const prompt = `You are a film and TV recommendation engine.

The user's history is below. "userRating" is the 0-10 score the user gave; null means they never rated it.

Recommend 10 films or series they have not seen that fit their taste.

Rules:
1. Never recommend anything in the history or in "alreadyTracked".
2. Only real, released titles. Give the exact original English title and the release year (first air year for series).
3. "basedOn": 1 to 3 titles copied exactly from the history that this pick is based on.
4. "reason": one short sentence explaining the connection by naming titles from "basedOn" and what they share (genre, tone, creator, cast, themes).
   NEVER mention any rating or score in the reason, and never claim the user rated something.
5. "predictedRating": how much this user is likely to enjoy it, 0.0 to 10.0.

Return JSON only, in this exact shape:
{"recommendations":[{"title":"Exact Title","year":2010,"mediaType":"movie","predictedRating":8.7,"basedOn":["Title From History"],"reason":"..."}]}
"mediaType" is "movie" or "tv".

History:
${JSON.stringify(profile)}

alreadyTracked:
${JSON.stringify(otherTracked)}`;

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
            contents: [{ role: "user", parts: [{ text: prompt }] }],
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
        rawResponseText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
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

    let rawRecs: RawRecommendation[] = [];
    try {
      const cleaned = rawResponseText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      rawRecs = (JSON.parse(cleaned) as { recommendations?: RawRecommendation[] }).recommendations || [];
    } catch {
      throw new ExternalServiceError("Gemini generated an invalid JSON response. Please try again.");
    }

    // --- Title guard: find the TMDB entry whose title and year match what Gemini meant ---
    // Lookups run in parallel; a wrong or invented TMDB id from the model is never trusted.
    const lookups = await Promise.all(
      rawRecs.slice(0, 12).map(async (rec) => {
        const mediaType = rec.mediaType === "movie" || rec.mediaType === "tv" ? rec.mediaType : null;
        if (!rec.title || !mediaType || trackedTitles.has(normalizeTitle(rec.title))) return null;
        try {
          const query = rec.year ? `${rec.title} ${rec.year}` : rec.title;
          const { results } = await TmdbService.searchMulti(query, tmdbKey, mediaType);
          const hit = results.find(
            (r) =>
              titlesMatch(r.title, rec.title!) &&
              (!rec.year || r.releaseYear === null || Math.abs(r.releaseYear - rec.year) <= 1)
          );
          if (!hit) {
            console.warn(`Discarded unverifiable recommendation: ${rec.title} (${rec.year ?? "?"})`);
            return null;
          }
          const match: AiRecommendationItem = {
            tmdbId: hit.id,
            mediaType: hit.mediaType,
            title: hit.title,
            reason: "",
            posterPath: hit.posterPath,
            yearRange: hit.yearRange,
          };
          return { rec, match };
        } catch (err) {
          console.warn(`TMDB lookup failed for "${rec.title}":`, err instanceof Error ? err.message : err);
          return null;
        }
      })
    );

    const verifiedRecs: AiRecommendationItem[] = [];
    const seen = new Set<string>();

    for (const lookup of lookups) {
      if (verifiedRecs.length >= MAX_RECOMMENDATIONS) break;
      if (!lookup) continue;
      const { rec, match } = lookup;

      const key = `${match.mediaType}:${match.tmdbId}`;
      if (trackedIds.has(key) || seen.has(key)) continue;
      seen.add(key);

      // --- Honesty guard: only cite real history and real ratings ---
      const basedOn = (rec.basedOn || [])
        .map((title) => historyTitles.get(normalizeTitle(title)))
        .filter((title): title is string => Boolean(title))
        .slice(0, 3);
      const reason = (rec.reason || "").trim();
      const citesHistory = basedOn.length > 0 && basedOn.some((title) => normalizeTitle(reason).includes(normalizeTitle(title)));

      match.reason =
        reason && citesHistory && reasonIsHonest(reason, ratedTitles)
          ? reason
          : basedOn.length > 0
          ? `Because you watched ${joinTitles(basedOn)}.`
          : "Picked from your watch history.";

      match.predictedRating =
        typeof rec.predictedRating === "number" && !isNaN(rec.predictedRating)
          ? Math.min(10, Math.max(0, Math.round(rec.predictedRating * 10) / 10))
          : undefined;

      verifiedRecs.push(match);
    }

    if (verifiedRecs.length === 0) {
      throw new ExternalServiceError(
        "Could not verify recommendations against TMDB. Please try again in a few moments."
      );
    }

    const now = new Date();
    await db.collection("users").updateOne(
      { _id: userObjectId },
      {
        $set: {
          recommendationsCache: {
            items: verifiedRecs,
            generatedAt: now,
            version: RECOMMENDATIONS_CACHE_VERSION,
          },
          updatedAt: now,
        },
      }
    );

    return { recommendations: verifiedRecs, generatedAt: now };
  }
}
