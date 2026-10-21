"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  PlayCircle,
  CheckCircle2,
  Search,
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
    <div className="flex flex-col gap-7 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-black text-5xl md:text-[76px] leading-[0.9]">My Lists</h1>
          <p className="text-sm text-smoke">Series move between lists automatically as you tick off episodes.</p>
        </div>
        <Link
          href="/search"
          className="hidden md:flex h-11 px-5 rounded-[10px] border border-plum-line items-center gap-2 text-sm font-semibold hover:border-green transition-colors"
        >
          <Search className="w-4 h-4" />
          Add a title
        </Link>
      </div>

      <div role="tablist" aria-label="Lists" className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "bg-plum-raised border-lilac" : "border-plum-line hover:border-lilac"
              }`}
            >
              <span className={`font-display font-extrabold text-2xl md:text-3xl leading-none ${active ? "text-green" : ""}`}>
                {tab.count}
              </span>
              <span className="text-xs md:text-[13px] font-semibold text-smoke truncate max-w-full px-1">{tab.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "all", label: "Everything" },
            { id: "movie", label: "Films" },
            { id: "tv", label: "Series" },
          ] as const
        ).map((pill) => {
          const active = filterType === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilterType(pill.id)}
              className={`h-[38px] px-4 rounded-full text-[13px] transition-colors ${
                active ? "bg-cream text-ink font-bold" : "border border-plum-line font-semibold hover:border-lilac"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-plum animate-pulse" />
          ))}
        </div>
      ) : currentTabItems.length > 0 ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-5 gap-y-7">
          {currentTabItems.map((item) => {
            const { tmdbId, mediaType, minimalSnapshot, override, rating } = item;
            return (
              <li key={`${mediaType}-${tmdbId}`}>
                <Link href={`/title/${mediaType}/${tmdbId}`} className="group flex flex-col gap-2.5">
                  <span className="relative block aspect-[2/3] rounded-md overflow-hidden bg-eggplant">
                    {minimalSnapshot.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${minimalSnapshot.posterPath}`}
                        alt={minimalSnapshot.title}
                        fill
                        sizes="(max-width: 640px) 50vw, 200px"
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    ) : (
                      <span className="absolute inset-0 p-3.5 flex items-end font-display font-black text-3xl leading-[0.88]">
                        {minimalSnapshot.title}
                      </span>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-[7px] py-1 rounded bg-ink/70 font-mono text-[10px] font-semibold tracking-[0.14em]">
                      {mediaType === "movie" ? "FILM" : "SERIES"}
                    </span>
                    {rating !== null && rating !== undefined && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-ink/80 font-display font-extrabold text-lg text-green">
                        {rating}
                      </span>
                    )}
                    {override && (
                      <span
                        className={`absolute bottom-2.5 left-2.5 px-2 py-1 rounded bg-ink/85 font-mono text-[10px] font-semibold tracking-[0.1em] ${
                          override === "on_hold" ? "text-gold" : "text-danger"
                        }`}
                      >
                        {override === "on_hold" ? "ON HOLD" : "DROPPED"}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[15px] leading-tight line-clamp-2 group-hover:text-green">
                      {minimalSnapshot.title}
                    </span>
                    <span className="font-mono text-xs text-smoke">{minimalSnapshot.yearRange || "TBA"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[14px] bg-plum p-10 text-center flex flex-col items-center gap-3">
          <p className="font-display font-extrabold text-3xl">Nothing here yet</p>
          <p className="text-sm text-smoke max-w-sm">
            {activeTab === "want_to_watch"
              ? "Search for a film or series and tap “Want to watch”."
              : activeTab === "currently_watching"
              ? "Tick off an episode of a series and it moves here."
              : "Finished series and films you’ve seen show up here."}
          </p>
          <Link
            href="/search"
            className="mt-2 h-11 px-5 rounded-[10px] bg-green text-ink text-sm font-bold flex items-center gap-2 ios-press"
          >
            <Search className="w-4 h-4" />
            Find something to watch
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ListsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-smoke text-sm animate-pulse">
          Loading library...
        </div>
      }
    >
      <ListsContent />
    </Suspense>
  );
}
