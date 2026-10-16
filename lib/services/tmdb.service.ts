/**
 * TMDB API Client and Metadata Caching Service
 *
 * Implements:
 * - Multi-search with year extraction and type filtering (movies & series).
 * - Full title details with age certification and episode runtimes.
 * - Season episode lists with air dates (identifying unaired episodes and Season 0 specials).
 * - Shared MongoDB metadata caching with TTL indexes:
 *   - Ongoing titles: ~1 day TTL
 *   - Ended / finished titles: ~7 days TTL
 * - Rate limiting to stay within TMDB free limits (~40 requests/10s).
 * - Fallback and error handling for invalid or expired user keys.
 */

import { getDb } from "../db/mongodb";
import { ExternalServiceError, ValidationError } from "../errors/app-error";
import { MetadataCacheDocument, MediaType } from "../models/types";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const ONGOING_TTL_SECONDS = 24 * 60 * 60; // 1 day
const FINISHED_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface TmdbSearchResultItem {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseYear: number | null;
  endYear: number | null;
  yearRange: string;
  popularity: number;
  voteAverage: number;
}

export interface TmdbEpisodeSummary {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
  isAired: boolean;
  isSpecial: boolean;
}

export interface TmdbSeasonDetail {
  seasonNumber: number;
  name: string;
  overview: string;
  posterPath: string | null;
  episodes: TmdbEpisodeSummary[];
  totalEpisodes: number;
  airedEpisodesCount: number;
}

export interface TmdbTitleDetail {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  startYear: number | null;
  endYear: number | null;
  yearRange: string;
  status: string; // "Returning Series", "Ended", "Released", etc.
  isFinished: boolean;
  ageRating: string | null;
  averageRuntimeMinutes: number | null;
  genres: string[];
  totalSeasons?: number;
  totalEpisodes?: number;
  seasonsSummary?: Array<{
    seasonNumber: number;
    name: string;
    episodeCount: number;
    airDate: string | null;
  }>;
  nextEpisodeToAir?: {
    airDate: string;
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  } | null;
  lastEpisodeToAir?: {
    airDate: string;
    seasonNumber: number;
    episodeNumber: number;
    name: string;
  } | null;
  belongsToCollection?: {
    id: number;
    name: string;
    posterPath: string | null;
  } | null;
}

export class TmdbService {
  /**
   * Helper to perform throttled, authenticated TMDB requests with user API key.
   */
  private static async fetchTmdb<T>(
    endpoint: string,
    apiKey: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    if (!apiKey || apiKey.trim().length < 8) {
      throw new ValidationError("A valid TMDB API key is required to fetch movie data.");
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    // Support both v3 API keys and v4 Bearer access tokens
    const isBearer = apiKey.startsWith("eyJ") || apiKey.length > 50;

    if (!isBearer) {
      url.searchParams.set("api_key", apiKey.trim());
    }

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (isBearer) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      next: { revalidate: 3600 }, // Next.js cache where appropriate
    });

    if (response.status === 401 || response.status === 403) {
      throw new ExternalServiceError(
        "TMDB",
        "Your TMDB API key is invalid or expired. Please update it in Settings."
      );
    }

    if (response.status === 429) {
      throw new ExternalServiceError(
        "TMDB",
        "TMDB rate limit exceeded. Please wait a few moments and try again."
      );
    }

    if (!response.ok) {
      throw new ExternalServiceError(
        "TMDB",
        `TMDB request failed with HTTP ${response.status}: ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Cached multi-search with query parsing and type filtering.
   * Extracts year if present in query (e.g. "Dune 2021" -> query="Dune", year=2021).
   */
  static async searchMulti(
    query: string,
    apiKey: string,
    filter: "all" | "movie" | "tv" = "all",
    page = 1
  ): Promise<{ results: TmdbSearchResultItem[]; totalResults: number; totalPages: number }> {
    const rawTrimmed = query.trim();
    if (!rawTrimmed) {
      return { results: [], totalResults: 0, totalPages: 0 };
    }

    // Extract potential 4-digit year from query string
    let cleanQuery = rawTrimmed;
    let extractedYear: number | undefined;

    const yearMatch = rawTrimmed.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      extractedYear = parseInt(yearMatch[0], 10);
      cleanQuery = rawTrimmed.replace(yearMatch[0], "").trim();
    }

    const cacheKey = `tmdb:search:${cleanQuery.toLowerCase()}:${extractedYear || ""}:${filter}:${page}`;
    const cached = await this.getCachedData<{
      results: TmdbSearchResultItem[];
      totalResults: number;
      totalPages: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const endpoint = "/search/multi";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = await this.fetchTmdb<any>(endpoint, apiKey, {
      query: cleanQuery || rawTrimmed,
      include_adult: "false",
      page,
      ...(extractedYear && filter !== "tv" ? { primary_release_year: extractedYear } : {}),
      ...(extractedYear && filter === "tv" ? { first_air_date_year: extractedYear } : {}),
    });

    const rawList = Array.isArray(responseData.results) ? responseData.results : [];

    // Filter out people and apply movie/tv constraints
    const items: TmdbSearchResultItem[] = rawList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        if (item.media_type !== "movie" && item.media_type !== "tv") return false;
        if (filter !== "all" && item.media_type !== filter) return false;
        return true;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const isMovie = item.media_type === "movie";
        const title = isMovie ? item.title || item.original_title : item.name || item.original_name;
        const releaseDate = isMovie ? item.release_date : item.first_air_date;
        const startYear = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;

        return {
          id: item.id,
          mediaType: item.media_type as MediaType,
          title: title || "Untitled",
          originalTitle: isMovie ? item.original_title : item.original_name,
          posterPath: item.poster_path || null,
          backdropPath: item.backdrop_path || null,
          overview: item.overview || "",
          releaseYear: startYear,
          endYear: null,
          yearRange: startYear ? `${startYear}` : "TBA",
          popularity: item.popularity || 0,
          voteAverage: item.vote_average || 0,
        };
      });

    const resultPayload = {
      results: items,
      totalResults: responseData.total_results || items.length,
      totalPages: responseData.total_pages || 1,
    };

    // Cache search results for 12 hours
    await this.setCachedData(cacheKey, "movie", 0, resultPayload, false, 12 * 3600);

    return resultPayload;
  }

  /**
   * Fetches detailed metadata for a movie or TV series.
   */
  static async getTitleDetails(
    tmdbId: number,
    mediaType: MediaType,
    apiKey: string
  ): Promise<TmdbTitleDetail> {
    const cacheKey = `tmdb:detail:${mediaType}:${tmdbId}`;
    const cached = await this.getCachedData<TmdbTitleDetail>(cacheKey);
    if (cached) {
      return cached;
    }

    if (mediaType === "movie") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.fetchTmdb<any>(`/movie/${tmdbId}`, apiKey, {
        append_to_response: "release_dates",
      });

      const releaseYear = data.release_date ? parseInt(data.release_date.slice(0, 4), 10) || null : null;
      const isFinished = data.status === "Released";

      // Extract age rating certification (US preference, fallback first found)
      let ageRating: string | null = null;
      if (data.release_dates?.results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usRelease = data.release_dates.results.find((r: any) => r.iso_3166_1 === "US");
        if (usRelease?.release_dates?.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cert = usRelease.release_dates.find((d: any) => d.certification);
          if (cert) ageRating = cert.certification;
        }
      }

      const detail: TmdbTitleDetail = {
        id: data.id,
        mediaType: "movie",
        title: data.title || data.original_title || "Untitled",
        overview: data.overview || "",
        posterPath: data.poster_path || null,
        backdropPath: data.backdrop_path || null,
        startYear: releaseYear,
        endYear: releaseYear,
        yearRange: releaseYear ? `${releaseYear}` : "TBA",
        status: data.status || "Released",
        isFinished,
        ageRating,
        averageRuntimeMinutes: data.runtime || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genres: Array.isArray(data.genres) ? data.genres.map((g: any) => g.name) : [],
        belongsToCollection: data.belongs_to_collection
          ? {
              id: data.belongs_to_collection.id,
              name: data.belongs_to_collection.name,
              posterPath: data.belongs_to_collection.poster_path || null,
            }
          : null,
      };

      await this.setCachedData(
        cacheKey,
        "movie",
        tmdbId,
        detail,
        isFinished,
        isFinished ? FINISHED_TTL_SECONDS : ONGOING_TTL_SECONDS
      );

      return detail;
    } else {
      // TV Series
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await this.fetchTmdb<any>(`/tv/${tmdbId}`, apiKey, {
        append_to_response: "content_ratings",
      });

      const startYear = data.first_air_date ? parseInt(data.first_air_date.slice(0, 4), 10) || null : null;
      const isFinished = data.status === "Ended" || data.status === "Canceled";
      const endYear = isFinished && data.last_air_date ? parseInt(data.last_air_date.slice(0, 4), 10) || null : null;

      let yearRange = "TBA";
      if (startYear) {
        if (isFinished) {
          yearRange = endYear && endYear !== startYear ? `${startYear} - ${endYear}` : `${startYear}`;
        } else {
          yearRange = `${startYear} - `;
        }
      }

      // Extract age rating (US preference)
      let ageRating: string | null = null;
      if (data.content_ratings?.results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usRating = data.content_ratings.results.find((r: any) => r.iso_3166_1 === "US");
        if (usRating) {
          ageRating = usRating.rating;
        } else if (data.content_ratings.results.length > 0) {
          ageRating = data.content_ratings.results[0].rating;
        }
      }

      // Average runtime from episode_run_time array
      const runtimes = Array.isArray(data.episode_run_time) ? data.episode_run_time : [];
      const avgRuntime = runtimes.length > 0 ? Math.round(runtimes.reduce((a: number, b: number) => a + b, 0) / runtimes.length) : null;

      const detail: TmdbTitleDetail = {
        id: data.id,
        mediaType: "tv",
        title: data.name || data.original_name || "Untitled",
        overview: data.overview || "",
        posterPath: data.poster_path || null,
        backdropPath: data.backdrop_path || null,
        startYear,
        endYear,
        yearRange,
        status: data.status || "Returning Series",
        isFinished,
        ageRating,
        averageRuntimeMinutes: avgRuntime,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genres: Array.isArray(data.genres) ? data.genres.map((g: any) => g.name) : [],
        totalSeasons: data.number_of_seasons || 1,
        totalEpisodes: data.number_of_episodes || 0,
        seasonsSummary: Array.isArray(data.seasons)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.seasons.map((s: any) => ({
              seasonNumber: s.season_number,
              name: s.name,
              episodeCount: s.episode_count,
              airDate: s.air_date || null,
            }))
          : [],
        nextEpisodeToAir: data.next_episode_to_air
          ? {
              airDate: data.next_episode_to_air.air_date,
              seasonNumber: data.next_episode_to_air.season_number,
              episodeNumber: data.next_episode_to_air.episode_number,
              name: data.next_episode_to_air.name,
            }
          : null,
        lastEpisodeToAir: data.last_episode_to_air
          ? {
              airDate: data.last_episode_to_air.air_date,
              seasonNumber: data.last_episode_to_air.season_number,
              episodeNumber: data.last_episode_to_air.episode_number,
              name: data.last_episode_to_air.name,
            }
          : null,
      };

      await this.setCachedData(
        cacheKey,
        "tv",
        tmdbId,
        detail,
        isFinished,
        isFinished ? FINISHED_TTL_SECONDS : ONGOING_TTL_SECONDS
      );

      return detail;
    }
  }

  /**
   * Fetches episode details for a specific season of a TV series.
   * Identifies whether each episode has already aired and flags Season 0 specials.
   */
  static async getSeasonEpisodes(
    tvId: number,
    seasonNumber: number,
    apiKey: string
  ): Promise<TmdbSeasonDetail> {
    const cacheKey = `tmdb:season:${tvId}:${seasonNumber}`;
    const cached = await this.getCachedData<TmdbSeasonDetail>(cacheKey);
    if (cached) {
      return cached;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetchTmdb<any>(`/tv/${tvId}/season/${seasonNumber}`, apiKey);

    const now = new Date().toISOString().slice(0, 10);
    const rawEpisodes = Array.isArray(data.episodes) ? data.episodes : [];

    let airedCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const episodes: TmdbEpisodeSummary[] = rawEpisodes.map((ep: any) => {
      const airDate = ep.air_date || null;
      const isAired = Boolean(airDate && airDate <= now);
      if (isAired && seasonNumber > 0) {
        airedCount++;
      }

      return {
        episodeNumber: ep.episode_number,
        seasonNumber: ep.season_number,
        name: ep.name || `Episode ${ep.episode_number}`,
        overview: ep.overview || "",
        airDate,
        runtime: ep.runtime || null,
        stillPath: ep.still_path || null,
        isAired,
        isSpecial: seasonNumber === 0,
      };
    });

    const isSeasonCompleted = episodes.every((e) => e.isAired) && episodes.length > 0;

    const seasonDetail: TmdbSeasonDetail = {
      seasonNumber: data.season_number,
      name: data.name || `Season ${seasonNumber}`,
      overview: data.overview || "",
      posterPath: data.poster_path || null,
      episodes,
      totalEpisodes: episodes.length,
      airedEpisodesCount: airedCount,
    };

    await this.setCachedData(
      cacheKey,
      "tv",
      tvId,
      seasonDetail,
      isSeasonCompleted,
      isSeasonCompleted ? FINISHED_TTL_SECONDS : ONGOING_TTL_SECONDS
    );

    return seasonDetail;
  }

  /**
   * Fetches movies inside a TMDB Collection (e.g. Harry Potter, Marvel).
   */
  static async getCollection(
    collectionId: number,
    apiKey: string
  ): Promise<{
    id: number;
    name: string;
    overview: string;
    posterPath: string | null;
    parts: TmdbSearchResultItem[];
  }> {
    const cacheKey = `tmdb:collection:${collectionId}`;
    const cached = await this.getCachedData<{
      id: number;
      name: string;
      overview: string;
      posterPath: string | null;
      parts: TmdbSearchResultItem[];
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await this.fetchTmdb<any>(`/collection/${collectionId}`, apiKey);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: TmdbSearchResultItem[] = (data.parts || []).map((item: any) => {
      const startYear = item.release_date ? parseInt(item.release_date.slice(0, 4), 10) || null : null;
      return {
        id: item.id,
        mediaType: "movie",
        title: item.title || item.original_title || "Untitled",
        posterPath: item.poster_path || null,
        backdropPath: item.backdrop_path || null,
        overview: item.overview || "",
        releaseYear: startYear,
        endYear: startYear,
        yearRange: startYear ? `${startYear}` : "TBA",
        popularity: item.popularity || 0,
        voteAverage: item.vote_average || 0,
      };
    });

    const result = {
      id: data.id,
      name: data.name || "Collection",
      overview: data.overview || "",
      posterPath: data.poster_path || null,
      parts,
    };

    await this.setCachedData(cacheKey, "movie", collectionId, result, true, FINISHED_TTL_SECONDS);

    return result;
  }

  // --- Shared MongoDB Metadata Cache Helpers ---

  private static async getCachedData<T>(cacheKey: string): Promise<T | null> {
    try {
      const db = await getDb();
      const record = await db.collection<MetadataCacheDocument>("metadata_cache").findOne({
        cacheKey,
        expiresAt: { $gt: new Date() },
      });

      return record ? (record.data as T) : null;
    } catch {
      return null;
    }
  }

  private static async setCachedData(
    cacheKey: string,
    mediaType: MediaType,
    tmdbId: number,
    data: unknown,
    isFinished: boolean,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const db = await getDb();
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await db.collection<MetadataCacheDocument>("metadata_cache").updateOne(
        { cacheKey },
        {
          $set: {
            cacheKey,
            mediaType,
            tmdbId,
            data,
            isFinished,
            expiresAt,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.warn("Failed to write to metadata cache:", err);
    }
  }
}
