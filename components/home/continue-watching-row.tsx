"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlayCircle, Check, Tv, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

interface ContinueWatchingItem {
  item: {
    _id: string;
    tmdbId: number;
    mediaType: "tv";
    minimalSnapshot: {
      title: string;
      posterPath: string | null;
      yearRange: string;
    };
  };
  nextEpisode: {
    season: number;
    episode: number;
  };
}

export function ContinueWatchingRow() {
  const { user } = useAuth();
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingKey, setMarkingKey] = useState<string | null>(null);

  const fetchContinueWatching = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/tracking/continue-watching");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setItems(json.data.items || []);
        }
      }
    } catch (err) {
      console.warn("Failed to load continue watching row:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        void fetchContinueWatching();
      }
    });
    return () => {
      mounted = false;
    };
  }, [fetchContinueWatching]);

  // Quick mark next episode watched directly from home screen
  const handleQuickMarkEpisode = async (
    tmdbId: number,
    seasonNumber: number,
    episodeNumber: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const key = `${tmdbId}-${seasonNumber}-${episodeNumber}`;
    setMarkingKey(key);

    try {
      const res = await fetch("/api/tracking/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          seasonNumber,
          episodeNumber,
          totalAiredEpisodes: 0,
        }),
      });

      if (res.ok) {
        // Refresh continue watching row
        await fetchContinueWatching();
      }
    } catch {
      alert("Failed to mark episode");
    } finally {
      setMarkingKey(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-[#0a84ff]" />
          <h2 className="text-lg font-bold text-white tracking-tight">Continue Watching</h2>
        </div>
        <Link
          href="/lists"
          className="text-xs text-[#0a84ff] font-semibold hover:underline flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="w-64 h-24 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] animate-pulse shrink-0"
            />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none">
          {items.map(({ item, nextEpisode }) => {
            const isMarking =
              markingKey === `${item.tmdbId}-${nextEpisode.season}-${nextEpisode.episode}`;

            return (
              <Link
                key={item._id}
                href={`/title/tv/${item.tmdbId}`}
                className="group relative w-64 p-3 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)] flex items-center gap-3 shrink-0 transition-all shadow-md"
              >
                {/* Poster Thumbnail */}
                <div className="relative w-14 h-20 rounded-xl overflow-hidden bg-[#141416] shrink-0 border border-white/10">
                  {item.minimalSnapshot.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${item.minimalSnapshot.posterPath}`}
                      alt={item.minimalSnapshot.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#8e8e93]">
                      <Tv className="w-5 h-5 opacity-40" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#0a84ff] transition-colors"
                    title={item.minimalSnapshot.title}
                  >
                    {item.minimalSnapshot.title}
                  </h3>
                  <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0a84ff]/15 border border-[#0a84ff]/30 text-[#0a84ff] text-[10px] font-bold">
                    <span>
                      S{nextEpisode.season} E{nextEpisode.episode}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#8e8e93] mt-1">Tap to open series</p>
                </div>

                {/* One-tap Mark Next Watched */}
                <button
                  onClick={(e) =>
                    handleQuickMarkEpisode(item.tmdbId, nextEpisode.season, nextEpisode.episode, e)
                  }
                  disabled={isMarking}
                  className="w-8 h-8 rounded-full bg-[#32d74b]/15 hover:bg-[#32d74b]/30 border border-[#32d74b]/30 text-[#32d74b] flex items-center justify-center shrink-0 transition-all disabled:opacity-50"
                  title={`Mark S${nextEpisode.season}E${nextEpisode.episode} watched`}
                >
                  {isMarking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="ios-card p-6 flex flex-col items-center justify-center text-center space-y-2">
          <Tv className="w-8 h-8 text-[#8e8e93] opacity-30" />
          <p className="text-xs font-semibold text-white">No active series currently in progress</p>
          <p className="text-[11px] text-[#8e8e93] max-w-xs">
            Start checking off episodes in your watchlist to have your next unwatched episode appear here.
          </p>
        </div>
      )}
    </section>
  );
}
