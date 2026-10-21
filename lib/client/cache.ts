"use client";

/**
 * Client-side stale-while-revalidate cache for API reads.
 *
 * Pages render the last known response instantly from memory/localStorage, then
 * refresh it from the network in the background. Entries are scoped by user id so
 * switching accounts never shows another account's data, and everything is wiped
 * on logout (see clearCache).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "trackit:cache:";
const MISS = Symbol("miss");

const memory = new Map<string, unknown>();
// Keys whose last network refresh failed while nothing was cached
const failures = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCached<T>(key: string): T | null {
  if (!memory.has(key)) {
    let value: unknown = MISS;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw !== null) value = JSON.parse(raw);
    } catch {
      // Storage unavailable (private mode) or corrupt entry: treat as a miss
    }
    memory.set(key, value);
  }
  const value = memory.get(key);
  return value === MISS ? null : (value as T);
}

export function setCached<T>(key: string, value: T) {
  memory.set(key, value);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: the in-memory copy still works
  }
  notify();
}

/** Drops every cached response (call on logout). */
export function clearCache() {
  memory.clear();
  failures.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }
  notify();
}

/** Cache key for a URL, scoped to a user (or "anon"). */
export function cacheKey(scope: string, url: string) {
  return `${scope}|${url}`;
}

/**
 * Reads `data` from a `{ success, data }` API response, showing the cached copy first.
 * Pass `url = null` to skip (e.g. while signed out).
 */
export function useCachedFetch<T>(url: string | null, scope: string | undefined) {
  const key = url && scope ? cacheKey(scope, url) : null;

  const data = useSyncExternalStore(
    subscribe,
    () => (key ? getCached<T>(key) : null),
    () => null
  );
  const failed = useSyncExternalStore(
    subscribe,
    () => (key ? failures.has(key) : false),
    () => false
  );

  const refresh = useCallback(async (): Promise<T | null> => {
    if (!key || !url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (json?.success) {
        failures.delete(key);
        setCached(key, json.data as T);
        return json.data as T;
      }
    } catch {
      // Offline or server error: keep showing the cached copy
    }
    if (getCached(key) === null && !failures.has(key)) {
      failures.add(key);
      notify();
    }
    return null;
  }, [key, url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Optimistically replace the cached value (e.g. after a mutation). */
  const mutate = useCallback(
    (updater: (prev: T | null) => T) => {
      if (key) setCached(key, updater(getCached<T>(key)));
    },
    [key]
  );

  return {
    data,
    isLoading: key !== null && data === null && !failed,
    refresh,
    mutate,
  };
}
