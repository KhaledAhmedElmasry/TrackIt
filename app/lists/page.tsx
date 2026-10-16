"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  PlayCircle,
  CheckCircle2,
  Film,
  Tv,
  Star,
  Search,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

interface TrackedItem {
  _id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  status: "want_to_watch" | "currently_watching" | "watched";
  override?: "dropped" | "on_hold" | null;
  rating?: number | null;
  notify?: boolean;
  minimalSnapshot: {
    tmdbId: number;
    mediaType: "movie" | "tv";
    title: string;
    posterPath: string | null;
    yearRange: string;
  };
  watchedEpisodes?: Array<{
    season: number;
    ranges: [number, number][];
  }>;
  updatedAt: string;
}

type TabType = "want_to_watch" | "currently_watching" | "watched";

function ListsContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabQuery = searchParams.get("tab");
  const [userSelectedTab, setUserSelectedTab] = useState<TabType | null>(null);
  const activeTab: TabType = userSelectedTab ?? (
    tabQuery === "currently_watching" || tabQuery === "watching"
      ? "currently_watching"
      : tabQuery === "watched"
      ? "watched"
      : "want_to_watch"
  );
  const setActiveTab = (tab: TabType) => setUserSelectedTab(tab);
  const [filterType, setFilterType] = useState<"all" | "movie" | "tv">("all");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [counts, setCounts] = useState({
    wantToWatch: 0,
    currentlyWatching: 0,
    watched: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLibrary = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/tracking");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setItems(json.data.items || []);
          if (json.data.counts) {
            setCounts({
              wantToWatch: json.data.counts.wantToWatch || 0,
              currentlyWatching: json.data.counts.currentlyWatching || 0,
              watched: json.data.counts.watched || 0,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch lists:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        void fetchLibrary();
      }
    });
    return () => {
      mounted = false;
    };
  }, [fetchLibrary]);

  // Filter items by active tab and mediaType filter
  const currentTabItems = items.filter((item) => {
    if (item.status !== activeTab) return false;
    if (filterType !== "all" && item.mediaType !== filterType) return false;
    return true;
  });

  const tabs: Array<{ id: TabType; name: string; icon: typeof Bookmark; count: number }> = [
    { id: "want_to_watch", name: "Want to Watch", icon: Bookmark, count: counts.wantToWatch },
    { id: "currently_watching", name: "Watching", icon: PlayCircle, count: counts.currentlyWatching },
    { id: "watched", name: "Watched", icon: CheckCircle2, count: counts.watched },
  ];

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            My Lists
          </h1>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Auto-derived status based on your watched episodes.
          </p>
        </div>

        <Link
          href="/search"
          className="p-2 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[rgba(255,255,255,0.08)] text-[#8e8e93] hover:text-white transition-all"
          title="Search titles to add"
        >
          <Search className="w-5 h-5" />
        </Link>
      </div>

      {/* iOS Segmented Control */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                active
                  ? "bg-[#2c2c2e] text-white shadow-sm"
                  : "text-[#8e8e93] hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.name}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active ? "bg-[#0a84ff] text-white" : "bg-white/10 text-[#8e8e93]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Media Type Filter Pills */}
      <div className="flex items-center gap-2">
        {(
          [
            { id: "all", label: "All" },
            { id: "movie", label: "Movies", icon: Film },
            { id: "tv", label: "Series", icon: Tv },
          ] as const
        ).map((pill) => {
          const Icon = "icon" in pill ? pill.icon : null;
          const active = filterType === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                active
                  ? "bg-[#0a84ff] text-white shadow-sm"
                  : "bg-[#1c1c1e] text-[#8e8e93] border border-[rgba(255,255,255,0.06)] hover:text-white"
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              <span>{pill.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid of Posters */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ios-card overflow-hidden animate-pulse aspect-[2/3] bg-[#1c1c1e]"
            />
          ))}
        </div>
      ) : currentTabItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {currentTabItems.map((item) => {
            const { tmdbId, mediaType, minimalSnapshot, override, rating } = item;
            return (
              <Link
                key={`${mediaType}-${tmdbId}`}
                href={`/title/${mediaType}/${tmdbId}`}
                className="group relative rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)] transition-all duration-200 flex flex-col"
              >
                {/* Poster Image */}
                <div className="relative aspect-[2/3] w-full bg-[#141416] overflow-hidden">
                  {minimalSnapshot.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${minimalSnapshot.posterPath}`}
                      alt={minimalSnapshot.title}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-[#8e8e93]">
                      {mediaType === "movie" ? (
                        <Film className="w-8 h-8 opacity-40 mb-1" />
                      ) : (
                        <Tv className="w-8 h-8 opacity-40 mb-1" />
                      )}
                      <span className="text-[11px] font-medium leading-tight line-clamp-2">
                        {minimalSnapshot.title}
                      </span>
                    </div>
                  )}

                  {/* Gradient shadow */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />

                  {/* Media Type Badge */}
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90 uppercase tracking-wider border border-white/10">
                    {mediaType === "movie" ? "Movie" : "Series"}
                  </div>

                  {/* Rating Badge if user rated */}
                  {rating && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-[#ffd60a] flex items-center gap-1 border border-white/10">
                      <Star className="w-3 h-3 fill-[#ffd60a]" />
                      <span>{rating}</span>
                    </div>
                  )}

                  {/* Manual Override Indicator */}
                  {override && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-bold flex items-center gap-1 border border-white/10">
                      {override === "on_hold" ? (
                        <>
                          <PauseCircle className="w-3 h-3 text-[#ff9f0a]" />
                          <span className="text-[#ff9f0a]">On Hold</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-[#ff453a]" />
                          <span className="text-[#ff453a]">Dropped</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Poster Info (Card shows only the name and release years) */}
                <div className="p-2.5">
                  <h3
                    className="text-xs font-semibold text-white line-clamp-1 group-hover:text-[#0a84ff] transition-colors"
                    title={minimalSnapshot.title}
                  >
                    {minimalSnapshot.title}
                  </h3>
                  <p className="text-[11px] text-[#8e8e93] mt-0.5">
                    {minimalSnapshot.yearRange || "TBA"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="ios-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#8e8e93]">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No titles in this list</h3>
            <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1">
              {activeTab === "want_to_watch"
                ? "Search for movies or shows and tap 'Want to Watch' to start tracking."
                : activeTab === "currently_watching"
                ? "Episodes you check off will automatically move shows here."
                : "Finished titles and movies you've completed appear here."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-semibold transition-all shadow-md"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search TMDB Database</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ListsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-[#8e8e93] text-sm animate-pulse">
          Loading library...
        </div>
      }
    >
      <ListsContent />
    </Suspense>
  );
}
