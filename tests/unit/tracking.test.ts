import { describe, it, expect } from "vitest";
import {
  isEpisodeInRange,
  addEpisodeToRanges,
  addRangeToIntervals,
  removeEpisodeFromRanges,
  countEpisodesInRanges,
  countTotalWatchedStandardEpisodes,
  deriveWatchStatus,
} from "@/lib/services/tracking.service";
import { SeasonWatchRange } from "@/lib/models/types";

describe("Tracking Service - Pure Interval Math", () => {
  describe("isEpisodeInRange", () => {
    const ranges: [number, number][] = [
      [1, 5],
      [8, 10],
    ];

    it("correctly identifies episodes inside intervals", () => {
      expect(isEpisodeInRange(ranges, 1)).toBe(true);
      expect(isEpisodeInRange(ranges, 3)).toBe(true);
      expect(isEpisodeInRange(ranges, 5)).toBe(true);
      expect(isEpisodeInRange(ranges, 8)).toBe(true);
      expect(isEpisodeInRange(ranges, 10)).toBe(true);
    });

    it("correctly identifies episodes outside intervals", () => {
      expect(isEpisodeInRange(ranges, 0)).toBe(false);
      expect(isEpisodeInRange(ranges, 6)).toBe(false);
      expect(isEpisodeInRange(ranges, 7)).toBe(false);
      expect(isEpisodeInRange(ranges, 11)).toBe(false);
    });
  });

  describe("addRangeToIntervals", () => {
    it("inserts a range into an empty list", () => {
      expect(addRangeToIntervals([], 1, 3)).toEqual([[1, 3]]);
    });

    it("merges adjacent intervals seamlessly", () => {
      // [1, 3] + [4, 6] -> [1, 6]
      const initial: [number, number][] = [[1, 3]];
      expect(addRangeToIntervals(initial, 4, 6)).toEqual([[1, 6]]);
    });

    it("merges overlapping intervals seamlessly", () => {
      // [1, 5] + [3, 8] -> [1, 8]
      const initial: [number, number][] = [[1, 5]];
      expect(addRangeToIntervals(initial, 3, 8)).toEqual([[1, 8]]);
    });

    it("bridges gaps between intervals", () => {
      // [[1, 3], [5, 7]] + 4 -> [[1, 7]]
      const initial: [number, number][] = [
        [1, 3],
        [5, 7],
      ];
      expect(addRangeToIntervals(initial, 4, 4)).toEqual([[1, 7]]);
    });

    it("keeps disjoint intervals separate", () => {
      // [1, 2] + [5, 6] -> [[1, 2], [5, 6]]
      const initial: [number, number][] = [[1, 2]];
      expect(addRangeToIntervals(initial, 5, 6)).toEqual([
        [1, 2],
        [5, 6],
      ]);
    });
  });

  describe("addEpisodeToRanges", () => {
    it("adds a single episode to an interval", () => {
      const ranges: [number, number][] = [[1, 2]];
      expect(addEpisodeToRanges(ranges, 3)).toEqual([[1, 3]]);
    });

    it("creates a single-episode interval [x, x]", () => {
      expect(addEpisodeToRanges([], 5)).toEqual([[5, 5]]);
    });
  });

  describe("removeEpisodeFromRanges", () => {
    it("trims the lower bound of an interval", () => {
      const ranges: [number, number][] = [[1, 5]];
      expect(removeEpisodeFromRanges(ranges, 1)).toEqual([[2, 5]]);
    });

    it("trims the upper bound of an interval", () => {
      const ranges: [number, number][] = [[1, 5]];
      expect(removeEpisodeFromRanges(ranges, 5)).toEqual([[1, 4]]);
    });

    it("splits an interval in the middle", () => {
      // [1, 5] without 3 -> [[1, 2], [4, 5]]
      const ranges: [number, number][] = [[1, 5]];
      expect(removeEpisodeFromRanges(ranges, 3)).toEqual([
        [1, 2],
        [4, 5],
      ]);
    });

    it("removes a single-episode interval completely", () => {
      const ranges: [number, number][] = [[3, 3]];
      expect(removeEpisodeFromRanges(ranges, 3)).toEqual([]);
    });

    it("returns unchanged intervals when episode is not in any range", () => {
      const ranges: [number, number][] = [[1, 5]];
      expect(removeEpisodeFromRanges(ranges, 10)).toEqual([[1, 5]]);
    });
  });

  describe("countEpisodesInRanges", () => {
    it("computes accurate episode counts", () => {
      expect(countEpisodesInRanges([])).toBe(0);
      expect(countEpisodesInRanges([[1, 1]])).toBe(1);
      expect(
        countEpisodesInRanges([
          [1, 5],
          [8, 10],
        ])
      ).toBe(8); // 5 + 3
    });
  });

  describe("countTotalWatchedStandardEpisodes", () => {
    it("counts regular seasons and strictly excludes Season 0 specials", () => {
      const seasons: SeasonWatchRange[] = [
        { season: 0, ranges: [[1, 10]] }, // 10 specials -> MUST NOT COUNT
        { season: 1, ranges: [[1, 8]] }, // 8 episodes
        { season: 2, ranges: [[1, 5], [7, 7]] }, // 6 episodes
      ];

      expect(countTotalWatchedStandardEpisodes(seasons)).toBe(14);
    });
  });

  describe("deriveWatchStatus", () => {
    it("handles movie status correctly", () => {
      expect(
        deriveWatchStatus({
          mediaType: "movie",
          watchedCount: 0,
          totalAiredCount: 0,
          isMovieWatched: false,
        })
      ).toBe("want_to_watch");

      expect(
        deriveWatchStatus({
          mediaType: "movie",
          watchedCount: 0,
          totalAiredCount: 0,
          isMovieWatched: true,
        })
      ).toBe("watched");
    });

    it("derives 'want_to_watch' when 0 episodes watched", () => {
      expect(
        deriveWatchStatus({
          mediaType: "tv",
          watchedCount: 0,
          totalAiredCount: 20,
        })
      ).toBe("want_to_watch");
    });

    it("derives 'currently_watching' when some aired episodes are watched", () => {
      expect(
        deriveWatchStatus({
          mediaType: "tv",
          watchedCount: 1,
          totalAiredCount: 10,
        })
      ).toBe("currently_watching");

      expect(
        deriveWatchStatus({
          mediaType: "tv",
          watchedCount: 9,
          totalAiredCount: 10,
        })
      ).toBe("currently_watching");
    });

    it("derives 'watched' when all aired episodes are watched", () => {
      expect(
        deriveWatchStatus({
          mediaType: "tv",
          watchedCount: 10,
          totalAiredCount: 10,
        })
      ).toBe("watched");

      expect(
        deriveWatchStatus({
          mediaType: "tv",
          watchedCount: 12,
          totalAiredCount: 10,
        })
      ).toBe("watched");
    });
  });

  describe("rating scale (0 to 10 with 2 decimal places)", () => {
    it("validates ratings within [0, 10] range and rounds to 2 decimal places", () => {
      const formatRating = (val: number) => Math.min(10, Math.max(0, Math.round(val * 100) / 100));

      expect(formatRating(8.5)).toBe(8.5);
      expect(formatRating(9.256)).toBe(9.26);
      expect(formatRating(10)).toBe(10);
      expect(formatRating(0)).toBe(0);
      expect(formatRating(7.1234)).toBe(7.12);
      expect(formatRating(11)).toBe(10);
      expect(formatRating(-1)).toBe(0);
    });
  });
});

