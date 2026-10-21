import { describe, it, expect, beforeEach } from "vitest";
import { cacheKey, clearCache, getCached, setCached } from "@/lib/client/cache";

describe("Client SWR cache", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns null on a miss and the stored value after a write", () => {
    const key = cacheKey("user-1", "/api/tracking");
    expect(getCached(key)).toBeNull();

    setCached(key, { items: [1, 2] });
    expect(getCached(key)).toEqual({ items: [1, 2] });
  });

  it("persists to localStorage so a reload can read it", () => {
    setCached(cacheKey("user-1", "/api/tracking/home"), { counts: { watched: 3 } });
    const raw = localStorage.getItem("trackit:cache:user-1|/api/tracking/home");
    expect(raw && JSON.parse(raw)).toEqual({ counts: { watched: 3 } });
  });

  it("keeps different accounts apart", () => {
    setCached(cacheKey("user-1", "/api/notifications"), { unreadCount: 5 });
    expect(getCached(cacheKey("user-2", "/api/notifications"))).toBeNull();
  });

  it("clearCache wipes memory and storage but leaves unrelated keys", () => {
    localStorage.setItem("other-app", "keep");
    setCached(cacheKey("user-1", "/api/tracking"), { items: [] });

    clearCache();

    expect(getCached(cacheKey("user-1", "/api/tracking"))).toBeNull();
    expect(localStorage.getItem("trackit:cache:user-1|/api/tracking")).toBeNull();
    expect(localStorage.getItem("other-app")).toBe("keep");
  });
});
