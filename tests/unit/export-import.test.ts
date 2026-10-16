import { describe, it, expect } from "vitest";
import { z } from "zod";
import { addRangeToIntervals } from "@/lib/services/tracking.service";

const ImportItemSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  status: z.enum(["want_to_watch", "currently_watching", "watched"]),
  override: z.enum(["dropped", "on_hold"]).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notify: z.boolean().optional(),
  minimalSnapshot: z.object({
    tmdbId: z.number().int().positive(),
    mediaType: z.enum(["movie", "tv"]),
    title: z.string().min(1),
    posterPath: z.string().nullable().optional(),
    yearRange: z.string().optional().default(""),
  }),
  watchedEpisodes: z
    .array(
      z.object({
        season: z.number().int().min(0),
        ranges: z.array(z.tuple([z.number(), z.number()])),
      })
    )
    .optional(),
});

describe("Data Export / Import Schema Validation", () => {
  it("validates a compliant movie item", () => {
    const movieItem = {
      tmdbId: 550,
      mediaType: "movie",
      status: "watched",
      rating: 5,
      notify: false,
      minimalSnapshot: {
        tmdbId: 550,
        mediaType: "movie",
        title: "Fight Club",
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        yearRange: "1999",
      },
      watchedEpisodes: [],
    };

    const parsed = ImportItemSchema.safeParse(movieItem);
    expect(parsed.success).toBe(true);
  });

  it("validates a compliant TV series item with compact ranges", () => {
    const seriesItem = {
      tmdbId: 1399,
      mediaType: "tv",
      status: "currently_watching",
      override: null,
      rating: 4,
      notify: true,
      minimalSnapshot: {
        tmdbId: 1399,
        mediaType: "tv",
        title: "Game of Thrones",
        posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
        yearRange: "2011 - 2019",
      },
      watchedEpisodes: [
        { season: 1, ranges: [[1, 10]] },
        { season: 2, ranges: [[1, 5]] },
      ],
    };

    const parsed = ImportItemSchema.safeParse(seriesItem);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid media types or negative IDs", () => {
    const invalidItem = {
      tmdbId: -1,
      mediaType: "anime", // not movie or tv
      status: "watched",
      minimalSnapshot: {
        tmdbId: -1,
        mediaType: "anime",
        title: "Invalid",
      },
    };

    const parsed = ImportItemSchema.safeParse(invalidItem);
    expect(parsed.success).toBe(false);
  });

  it("merges intervals from import into existing intervals without data loss", () => {
    let existingRanges: [number, number][] = [[1, 3], [7, 8]];
    const incomingRanges: [number, number][] = [[4, 6], [8, 10]];

    for (const [from, to] of incomingRanges) {
      existingRanges = addRangeToIntervals(existingRanges, from, to);
    }

    // [1, 3] + [4, 6] merged into [1, 6]
    // [7, 8] + [8, 10] merged into [7, 10]
    // [1, 6] and [7, 10] are contiguous, so they seamlessly merge into a single compact interval [1, 10]
    expect(existingRanges).toEqual([[1, 10]]);
  });
});
