/**
 * Pure Numerical Range & Watch Status Algorithms
 *
 * Safe for both Client Components and Server-side Code.
 * Zero external dependencies, zero Node.js/MongoDB modules.
 */

import { MediaType, WatchStatus, SeasonWatchRange } from "../models/types";

/**
 * Checks whether an episode number is contained within any contiguous [from, to] interval.
 */
export function isEpisodeInRange(ranges: [number, number][], episodeNumber: number): boolean {
  for (const [from, to] of ranges) {
    if (episodeNumber >= from && episodeNumber <= to) {
      return true;
    }
  }
  return false;
}

/**
 * Inserts an episode into the intervals, merging adjacent and overlapping intervals.
 * e.g., [[1, 3], [5, 5]] + 4 -> [[1, 5]]
 */
export function addEpisodeToRanges(
  ranges: [number, number][],
  episodeNumber: number
): [number, number][] {
  return addRangeToIntervals(ranges, episodeNumber, episodeNumber);
}

/**
 * Adds an entire contiguous [from, to] range, merging seamlessly.
 */
export function addRangeToIntervals(
  ranges: [number, number][],
  from: number,
  to: number
): [number, number][] {
  if (from > to) return ranges;

  const all: [number, number][] = [...ranges, [from, to]];
  // Sort by starting bound
  all.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const interval of all) {
    if (merged.length === 0) {
      merged.push(interval);
      continue;
    }

    const last = merged[merged.length - 1];
    // If current interval overlaps or is directly adjacent to last (e.g. [1, 3] and [4, 5])
    if (interval[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push(interval);
    }
  }

  return merged;
}

/**
 * Removes an episode number from intervals, splitting or trimming intervals as required.
 */
export function removeEpisodeFromRanges(
  ranges: [number, number][],
  episodeNumber: number
): [number, number][] {
  const result: [number, number][] = [];

  for (const [from, to] of ranges) {
    if (episodeNumber < from || episodeNumber > to) {
      // Outside this interval
      result.push([from, to]);
    } else {
      // Inside this interval
      if (episodeNumber > from) {
        result.push([from, episodeNumber - 1]);
      }
      if (episodeNumber < to) {
        result.push([episodeNumber + 1, to]);
      }
    }
  }

  return result;
}

/**
 * Counts total episodes inside an array of [from, to] intervals.
 */
export function countEpisodesInRanges(ranges: [number, number][]): number {
  return ranges.reduce((acc, [from, to]) => acc + (to - from + 1), 0);
}

/**
 * Computes total watched episodes across seasons, excluding Season 0 (specials).
 */
export function countTotalWatchedStandardEpisodes(seasons: SeasonWatchRange[]): number {
  return seasons
    .filter((s) => s.season > 0)
    .reduce((acc, s) => acc + countEpisodesInRanges(s.ranges), 0);
}

/**
 * Pure status derivation logic based on watched count and total aired count.
 */
export function deriveWatchStatus(params: {
  mediaType: MediaType;
  watchedCount: number;
  totalAiredCount: number;
  isMovieWatched?: boolean;
}): WatchStatus {
  const { mediaType, watchedCount, totalAiredCount, isMovieWatched } = params;

  if (mediaType === "movie") {
    return isMovieWatched ? "watched" : "want_to_watch";
  }

  // TV Series
  if (watchedCount === 0) {
    return "want_to_watch";
  }

  if (totalAiredCount > 0 && watchedCount >= totalAiredCount) {
    return "watched";
  }

  return "currently_watching";
}
