import { describe, it, expect } from "vitest";
import { normalizeTitle, reasonIsHonest } from "@/lib/services/gemini.service";

describe("Recommendation guards", () => {
  it("normalizes titles for comparison", () => {
    expect(normalizeTitle("The Dark Knight")).toBe("dark knight");
    expect(normalizeTitle("Marvel's Daredevil")).toBe("marvel s daredevil");
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("Fast & Furious")).toBe("fast and furious");
  });

  const rated = [
    { title: "Interstellar", rating: 10 },
    { title: "The Rookie", rating: 8.5 },
  ];

  it("accepts reasons that quote no ratings", () => {
    expect(reasonIsHonest("Fans of Interstellar's scale will love this.", rated)).toBe(true);
  });

  it("accepts a rating the user really gave to that title", () => {
    expect(reasonIsHonest("Because you rated Interstellar 10/10, try this.", rated)).toBe(true);
  });

  it("rejects an invented rating for an unrated title", () => {
    expect(reasonIsHonest("Given your 9/10 rating for Marvel's Daredevil, this fits.", rated)).toBe(false);
  });

  it("rejects a real rating number attached to the wrong title", () => {
    expect(reasonIsHonest("Given your 8.5/10 rating for Daredevil, this fits.", rated)).toBe(false);
  });
});
