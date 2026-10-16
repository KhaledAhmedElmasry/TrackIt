"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search as SearchIcon,
  X,
  Plus,
  Check,
  Film,
  Tv,
  Key,
  Layers,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

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

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackedMap, setTrackedMap] = useState<TrackedSummary>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Multi-select bulk state
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current user library to display existing badges
  const loadUserLibrary = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/tracking");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.items) {
          const map: TrackedSummary = {};
          for (const item of json.data.items) {
            map[`${item.mediaType}-${item.tmdbId}`] = { status: item.status };
          }
          setTrackedMap(map);
        }
      }
    } catch (err) {
      console.warn("Failed to load user tracked items:", err);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void loadUserLibrary();
    });
    return () => {
      mounted = false;
    };
  }, [loadUserLibrary]);

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
    }, 300);

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
        setTrackedMap((prev) => ({
          ...prev,
          [key]: { status: "want_to_watch" },
        }));
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
        setTrackedMap((prev) => {
          const next = { ...prev };
          for (const item of itemsToAdd) {
            next[`${item.mediaType}-${item.tmdbId}`] = { status: "want_to_watch" };
          }
          return next;
        });
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
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Search
          </h1>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Search millions of movies and series powered by TMDB.
          </p>
        </div>

        {results.length > 0 && (
          <button
            onClick={() => {
              setIsMultiSelect(!isMultiSelect);
              if (isMultiSelect) setSelectedKeys(new Set());
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isMultiSelect
                ? "bg-[#0a84ff] text-white"
                : "bg-[#1c1c1e] text-[#8e8e93] border border-[rgba(255,255,255,0.08)] hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isMultiSelect ? "Cancel Selection" : "Bulk Select"}</span>
          </button>
        )}
      </div>

      {/* TMDB Key Alert if user hasn't added one yet */}
      {user && !hasTmdbKey && (
        <div className="p-4 rounded-2xl bg-[#2c1d0a] border border-[#f59e0b]/40 backdrop-blur-xl flex items-start gap-3">
          <Key className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-[#fef3c7]">TMDB API Key Required</p>
            <p className="text-[#fde68a]/90 leading-relaxed">
              To search titles and track episode releases, add your free TMDB API key in Settings.
            </p>
            <Link
              href="/profile"
              className="inline-block text-[#0a84ff] font-semibold hover:underline pt-1"
            >
              Add free TMDB Key in Settings &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* iOS styled Search Bar with Clear Button */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#0a84ff]" />
          ) : (
            <SearchIcon className="w-5 h-5" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, or add a year (e.g. 'Batman 2022')..."
          className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#8e8e93] text-sm focus:outline-none focus:border-[#0a84ff] transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8e8e93] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs & Bulk Select Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)]">
          {(
            [
              { id: "all", label: "All" },
              { id: "movie", label: "Movies", icon: Film },
              { id: "tv", label: "TV Series", icon: Tv },
            ] as const
          ).map((tab) => {
            const Icon = "icon" in tab ? tab.icon : null;
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  active
                    ? "bg-[#0a84ff] text-white shadow-sm"
                    : "text-[#8e8e93] hover:text-white"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {isMultiSelect && results.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="px-3 py-1.5 text-xs text-[#0a84ff] font-semibold hover:underline flex items-center gap-1"
          >
            {selectedKeys.size === results.length ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-[#2a0e0e] border border-[#ff453a]/40 text-xs text-[#ff9f98]">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Results Grid */}
      {isLoading && results.length === 0 ? (
        // Skeleton Loaders
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="ios-card overflow-hidden animate-pulse flex flex-col aspect-[2/3] bg-[#1c1c1e]"
            >
              <div className="w-full h-full bg-[#2c2c2e]/50" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {results.map((item) => {
            const itemKey = `${item.mediaType}-${item.id}`;
            const tracked = trackedMap[itemKey];
            const isSelected = selectedKeys.has(itemKey);
            const isAdding = addingId === itemKey;

            return (
              <div
                key={itemKey}
                onClick={(e) => {
                  if (isMultiSelect) {
                    toggleSelectItem(itemKey, e);
                  }
                }}
                className={`group relative rounded-2xl overflow-hidden bg-[#1c1c1e] border transition-all duration-200 flex flex-col ${
                  isSelected
                    ? "border-[#0a84ff] ring-2 ring-[#0a84ff]/40 shadow-lg scale-[0.99]"
                    : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)]"
                }`}
              >
                {/* Poster Link */}
                <Link
                  href={`/title/${item.mediaType}/${item.id}`}
                  className="block relative aspect-[2/3] w-full bg-[#141416] overflow-hidden"
                >
                  {item.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-[#8e8e93]">
                      {item.mediaType === "movie" ? (
                        <Film className="w-8 h-8 opacity-40 mb-1" />
                      ) : (
                        <Tv className="w-8 h-8 opacity-40 mb-1" />
                      )}
                      <span className="text-[11px] font-medium leading-tight line-clamp-2">
                        {item.title}
                      </span>
                    </div>
                  )}

                  {/* Gradient bottom shadow */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

                  {/* Media Type Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90 uppercase tracking-wider border border-white/10">
                    {item.mediaType === "movie" ? "Movie" : "Series"}
                  </div>

                  {/* Multi-Select Checkbox overlay */}
                  {isMultiSelect && (
                    <button
                      onClick={(e) => toggleSelectItem(itemKey, e)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 backdrop-blur-md text-white border border-white/20"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#0a84ff]" />
                      ) : (
                        <Square className="w-4 h-4 text-white/70" />
                      )}
                    </button>
                  )}
                </Link>

                {/* Info Card Content */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <Link
                      href={`/title/${item.mediaType}/${item.id}`}
                      className="text-xs font-semibold text-white line-clamp-1 hover:text-[#0a84ff] transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                    <p className="text-[11px] text-[#8e8e93] mt-0.5">
                      {item.yearRange || "TBA"}
                    </p>
                  </div>

                  {/* Action / Status Pill */}
                  <div className="mt-2.5">
                    {tracked ? (
                      <div className="w-full py-1 px-2 rounded-lg bg-[#32d74b]/15 border border-[#32d74b]/30 text-[#32d74b] text-[10px] font-bold flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" />
                        <span className="capitalize">
                          {tracked.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleQuickAdd(item, e)}
                        disabled={isAdding}
                        className="w-full py-1 px-2 rounded-lg bg-[#0a84ff]/20 hover:bg-[#0a84ff]/30 border border-[#0a84ff]/40 text-[#0a84ff] text-[10px] font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        {isAdding ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        <span>Want to Watch</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : query.trim() ? (
        // No results state
        <div className="ios-card p-12 text-center space-y-2">
          <Film className="w-10 h-10 text-[#8e8e93] mx-auto opacity-30" />
          <p className="text-base font-semibold text-white">No results found</p>
          <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
            We couldn&apos;t find any titles matching &quot;{query}&quot;. Try checking for typos or searching by the English title.
          </p>
        </div>
      ) : (
        // Initial state before search
        <div className="ios-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0a84ff]/10 border border-[#0a84ff]/20 flex items-center justify-center mx-auto text-[#0a84ff]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Discover Movies & Shows</h3>
            <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1">
              Type above to search by name or release year (e.g. &quot;Inception&quot;, &quot;Breaking Bad&quot;, or &quot;Dune 2021&quot;).
            </p>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar (when in multi-select mode) */}
      {isMultiSelect && selectedKeys.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-md p-3 rounded-2xl bg-[#1c1c1e]/95 border border-[#0a84ff]/40 backdrop-blur-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <span className="text-xs font-semibold text-white pl-2">
            {selectedKeys.size} {selectedKeys.size === 1 ? "item" : "items"} selected
          </span>
          <button
            onClick={handleBulkAdd}
            disabled={isBulkAdding}
            className="px-4 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
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
