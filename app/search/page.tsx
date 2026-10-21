"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Search as SearchIcon,
  X,
  Plus,
  Check,
  Key,
  Layers,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useCachedFetch } from "@/lib/client/cache";

interface SearchResultItem {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  releaseYear: number | null;
  endYear: number | null;
  yearRange: string;
  popularity: number;
  voteAverage: number;
}

interface TrackedSummary {
  [key: string]: {
    status: "want_to_watch" | "currently_watching" | "watched";
  };
}

const STATUS_LABELS: Record<string, string> = {
  want_to_watch: "On your list",
  currently_watching: "Watching",
  watched: "Watched",
};

export default function SearchPage() {
  const { user } = useAuth();
  // ?q= lets the sidebar search box hand its query to this page
  const urlQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Titles added on this page, shown immediately while the library cache refreshes
  const [addedMap, setAddedMap] = useState<TrackedSummary>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Multi-select bulk state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User library (shared cache with My Lists) to show which results are already tracked
  const { data: library, refresh: refreshLibrary } = useCachedFetch<{
    items: Array<{ tmdbId: number; mediaType: string; status: TrackedSummary[string]["status"] }>;
  }>(user ? "/api/tracking" : null, user?.id);
  const trackedMap = useMemo(() => {
    const map: TrackedSummary = {};
    for (const item of library?.items ?? []) {
      map[`${item.mediaType}-${item.tmdbId}`] = { status: item.status };
    }
    return { ...map, ...addedMap };
  }, [library, addedMap]);

  // Execute TMDB search
  const performSearch = useCallback(
    async (searchQuery: string, type: "all" | "movie" | "tv") => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      // Cancel previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: trimmed,
          type,
        });

        const res = await fetch(`/api/tmdb/search?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || `Search failed (${res.status})`);
        }

        const json = await res.json();
        if (json.success && Array.isArray(json.data?.results)) {
          setResults(json.data.results);
        } else {
          setResults([]);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounce search on query or filter type change
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      let mounted = true;
      queueMicrotask(() => {
        if (mounted) {
          setResults([]);
          setIsLoading(false);
        }
      });
      return () => {
        mounted = false;
      };
    }

    searchTimeoutRef.current = setTimeout(() => {
      setIsLoading(true);
      performSearch(query, filterType);
    }, 50);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, filterType, performSearch]);

  // One-tap Add to Want to Watch
  const handleQuickAdd = async (item: SearchResultItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const key = `${item.mediaType}-${item.id}`;
    setAddingId(key);

    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: item.mediaType,
          title: item.title,
          posterPath: item.posterPath,
          yearRange: item.yearRange,
          notify: item.mediaType === "tv",
        }),
      });

      if (res.ok) {
        setAddedMap((prev) => ({
          ...prev,
          [key]: { status: "want_to_watch" },
        }));
        void refreshLibrary();
      } else {
        const json = await res.json();
        alert(json.error || "Failed to add title");
      }
    } catch {
      alert("Failed to track title. Check network connection.");
    } finally {
      setAddingId(null);
    }
  };

  // Toggle multi-select checkbox for an item
  const toggleSelectItem = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedKeys.size === results.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(results.map((r) => `${r.mediaType}-${r.id}`)));
    }
  };

  // Bulk add selected items
  const handleBulkAdd = async () => {
    if (selectedKeys.size === 0) return;
    setIsBulkAdding(true);

    try {
      const itemsToAdd = results
        .filter((r) => selectedKeys.has(`${r.mediaType}-${r.id}`))
        .map((r) => ({
          tmdbId: r.id,
          mediaType: r.mediaType,
          title: r.title,
          posterPath: r.posterPath,
          yearRange: r.yearRange,
          status: "want_to_watch" as const,
        }));

      const res = await fetch("/api/tracking/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_items",
          items: itemsToAdd,
        }),
      });

      if (res.ok) {
        setAddedMap((prev) => {
          const next = { ...prev };
          for (const item of itemsToAdd) {
            next[`${item.mediaType}-${item.tmdbId}`] = { status: "want_to_watch" };
          }
          return next;
        });
        void refreshLibrary();
        setSelectedKeys(new Set());
        setIsMultiSelect(false);
      } else {
        const json = await res.json();
        alert(json.error || "Failed to bulk add items");
      }
    } catch {
      alert("Bulk add failed. Check network connection.");
    } finally {
      setIsBulkAdding(false);
    }
  };

  const hasTmdbKey = user?.hasTmdbKey ?? false;

  return (
    <div className="flex flex-col gap-7 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display font-black text-5xl md:text-[76px] leading-[0.9]">Find a title</h1>
        {results.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setIsMultiSelect(!isMultiSelect);
              if (isMultiSelect) setSelectedKeys(new Set());
            }}
            className={`btn-quiet h-10 px-4 rounded-full text-[13px] font-semibold flex items-center gap-2 transition-colors ${
              isMultiSelect ? "bg-cream text-ink" : "border border-plum-line text-smoke hover:text-cream"
            }`}
          >
            <Layers className="w-4 h-4" />
            {isMultiSelect ? "Cancel selection" : "Select several"}
          </button>
        )}
      </div>

      {user && !hasTmdbKey && (
        <div className="p-4 rounded-xl bg-plum border border-gold/40 flex items-start gap-3">
          <Key className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">TMDB key needed</p>
            <p className="text-smoke">To search and track titles, add your free TMDB API key in Settings.</p>
            <Link href="/profile" className="text-green font-semibold hover:underline pt-1">
              Add TMDB key in Settings &rarr;
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <div className="relative">
          <label htmlFor="search-query" className="sr-only">
            Search films and series
          </label>
          <span className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-green" />
            ) : (
              <SearchIcon className="w-6 h-6 text-green" strokeWidth={2.2} />
            )}
          </span>
          <input
            id="search-query"
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search films & series"
            className="w-full h-16 rounded-[14px] border-2 border-eggplant bg-night pl-14 pr-12 text-lg md:text-[22px] font-semibold text-cream placeholder:text-dim focus:border-green focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute inset-y-0 right-2 w-11 flex items-center justify-center text-smoke hover:text-cream"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: "Everything" },
              { id: "movie", label: "Films" },
              { id: "tv", label: "Series" },
            ] as const
          ).map((tab) => {
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterType(tab.id)}
                className={`h-[38px] px-4 rounded-full text-[13px] transition-colors ${
                  active ? "bg-cream text-ink font-bold" : "border border-plum-line font-semibold hover:border-lilac"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          {isMultiSelect && results.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="h-[38px] px-3 text-[13px] text-green font-semibold hover:underline"
            >
              {selectedKeys.size === results.length ? "Deselect all" : "Select all"}
            </button>
          )}
          <span className="ml-auto font-mono text-xs tracking-[0.08em] text-smoke">
            {results.length > 0 ? `${results.length} RESULTS · ` : ""}TIP: ADD A YEAR, &ldquo;DUNE 1984&rdquo;
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-plum border border-danger/40 text-sm text-danger">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {isLoading && results.length === 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-7">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-plum animate-pulse" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-7">
          {results.map((item) => {
            const itemKey = `${item.mediaType}-${item.id}`;
            const tracked = trackedMap[itemKey];
            const isSelected = selectedKeys.has(itemKey);
            const isAdding = addingId === itemKey;

            return (
              <li key={itemKey} className="group flex flex-col gap-2.5">
                <Link
                  href={`/title/${item.mediaType}/${item.id}`}
                  onClick={(e) => {
                    if (isMultiSelect) toggleSelectItem(itemKey, e);
                  }}
                  className={`poster-hover relative block aspect-[2/3] rounded-md overflow-hidden bg-eggplant ${
                    isSelected ? "ring-[3px] ring-green ring-offset-2 ring-offset-ink" : ""
                  }`}
                >
                  {item.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 200px"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <span className="absolute inset-0 p-3.5 flex items-end font-display font-black text-3xl leading-[0.88]">
                      {item.title}
                    </span>
                  )}
                  <span className="absolute top-2.5 left-2.5 px-[7px] py-1 rounded bg-ink/70 font-mono text-[10px] font-semibold tracking-[0.14em]">
                    {item.mediaType === "movie" ? "FILM" : "SERIES"}
                  </span>
                  {isMultiSelect && (
                    <span className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-ink/80 flex items-center justify-center">
                      {isSelected ? <CheckSquare className="w-5 h-5 text-green" /> : <Square className="w-5 h-5 text-smoke" />}
                    </span>
                  )}
                </Link>

                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/title/${item.mediaType}/${item.id}`}
                    className="font-semibold text-[15px] leading-tight line-clamp-2 hover:text-green"
                  >
                    {item.title}
                  </Link>
                  <span className="font-mono text-xs text-smoke">{item.yearRange || "TBA"}</span>
                </div>

                {tracked ? (
                  <span className="h-10 rounded-[9px] bg-plum-raised text-[#e2cce8] text-[13px] font-semibold flex items-center justify-center gap-2">
                    <Check className="w-4 h-4 text-green" strokeWidth={2.8} />
                    {STATUS_LABELS[tracked.status] ?? "On your list"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(item, e)}
                    disabled={isAdding}
                    className="btn-outline h-10 rounded-[9px] border border-green text-green text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-green hover:text-ink transition-colors disabled:opacity-60"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.6} />}
                    Want to watch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : query.trim() ? (
        <div className="rounded-[14px] bg-plum p-10 text-center flex flex-col gap-2">
          <p className="font-display font-extrabold text-3xl">No results</p>
          <p className="text-sm text-smoke max-w-sm mx-auto">
            Nothing matches &ldquo;{query}&rdquo;. Check the spelling or try the English title.
          </p>
        </div>
      ) : (
        <div className="rounded-[14px] bg-plum p-10 text-center flex flex-col gap-2">
          <p className="font-display font-extrabold text-3xl">What are we watching?</p>
          <p className="text-sm text-smoke max-w-md mx-auto">
            Search by name, or add a year to narrow it down: &ldquo;Inception&rdquo;, &ldquo;Breaking Bad&rdquo;, &ldquo;Dune 2021&rdquo;.
          </p>
        </div>
      )}
      {/* Floating Bulk Action Bar (when in multi-select mode) */}
      {isMultiSelect && selectedKeys.size > 0 && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 md:left-[calc(50%+8rem)] -translate-x-1/2 z-40 w-11/12 max-w-md p-3 rounded-[14px] bg-plum-raised border border-green/40 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <span className="text-xs font-semibold text-cream pl-2">
            {selectedKeys.size} {selectedKeys.size === 1 ? "item" : "items"} selected
          </span>
          <button
            onClick={handleBulkAdd}
            disabled={isBulkAdding}
            className="btn-primary px-4 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
          >
            {isBulkAdding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Add to Want to Watch</span>
          </button>
        </div>
      )}
    </div>
  );
}
