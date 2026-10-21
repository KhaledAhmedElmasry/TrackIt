"use client";

import { useState, useEffect, useCallback, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  ChevronLeft,
  Star,
  Film,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Plus,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { TmdbTitleDetail, TmdbSeasonDetail } from "@/lib/services/tmdb.service";
import { TrackedItemDocument } from "@/lib/models/types";
import { isEpisodeInRange } from "@/lib/utils/ranges";
import { useAuth } from "@/components/auth/auth-context";
import { cacheKey, getCached, setCached } from "@/lib/client/cache";

interface CollectionPart {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  yearRange: string;
  voteAverage: number;
  isWatched: boolean;
  status: string | null;
}

interface CollectionDetail {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  parts: CollectionPart[];
}

/** Number of regular episodes the user has watched in one season. */
function countWatchedInSeason(tracked: TrackedItemDocument | null, seasonNumber: number): number {
  const entry = tracked?.watchedEpisodes?.find((e) => e.season === seasonNumber);
  return entry ? entry.ranges.reduce((sum, [from, to]) => sum + (to - from + 1), 0) : 0;
}

function SeasonProgress({
  watched,
  season,
  onMarkSeason,
}: {
  watched: number;
  season: TmdbSeasonDetail;
  onMarkSeason: () => void;
}) {
  const upcoming = season.totalEpisodes - season.airedEpisodesCount;
  const pct = Math.min(100, Math.round((watched / Math.max(1, season.totalEpisodes)) * 100));

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3.5 rounded-xl bg-night">
      <div className="flex-1 min-w-[220px] flex flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.08em] text-smoke">
          {watched} OF {season.airedEpisodesCount} AIRED
          {upcoming > 0 && ` · ${upcoming} UPCOMING`}
        </span>
        <div className="h-3 rounded-[3px] bg-plum-raised overflow-hidden">
          <div className="h-3 bg-green transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {season.airedEpisodesCount > 0 && watched < season.airedEpisodesCount && (
        <button
          type="button"
          onClick={onMarkSeason}
          className="btn-outline h-11 px-[18px] rounded-[10px] border border-green text-green text-sm font-semibold ios-press"
        >
          Mark season watched
        </button>
      )}
    </div>
  );
}

interface TitleDetailClientProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

export function TitleDetailClient({ params }: TitleDetailClientProps) {
  const resolvedParams = use(params);
  const mediaType = resolvedParams.type as "movie" | "tv";
  const tmdbId = parseInt(resolvedParams.id, 10);

  const router = useRouter();
  const { user } = useAuth();

  const [details, setDetails] = useState<TmdbTitleDetail | null>(null);
  const [tracked, setTracked] = useState<TrackedItemDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Seasons episode cache: seasonNumber -> TmdbSeasonDetail
  const [seasonsCache, setSeasonsCache] = useState<Record<number, TmdbSeasonDetail>>({});
  // Season shown in the episode checklist (0 = specials)
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);

  // 0-10 Rating Modal State
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState<string>("");
  const [isSavingRating, setIsSavingRating] = useState(false);

  // Franchise Collection Dropdown State
  const [isCollectionExpanded, setIsCollectionExpanded] = useState(false);
  const [collectionDetail, setCollectionDetail] = useState<CollectionDetail | null>(null);
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<number>>(new Set());
  const [isUpdatingCollectionParts, setIsUpdatingCollectionParts] = useState(false);

  // Action states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMarkingCollection, setIsMarkingCollection] = useState(false);

  // Fetch title details and current user tracking info
  // Title details + your tracking for it, cached per account for instant repeat visits
  const titleUrl = `/api/tmdb/title?id=${tmdbId}&type=${mediaType}`;
  const titleCacheKey = user ? cacheKey(user.id, titleUrl) : null;

  const loadTitle = useCallback(async () => {
    type TitlePayload = { details: TmdbTitleDetail; tracked: TrackedItemDocument | null };

    // Open on the season holding the next episode to watch (else the first season)
    const pickSeason = (payload: TitlePayload) => {
      if (mediaType !== "tv") return;
      const seasons = (payload.details.seasonsSummary || []).filter((s) => s.seasonNumber > 0);
      const current =
        seasons.find((s) => countWatchedInSeason(payload.tracked, s.seasonNumber) < s.episodeCount) || seasons[0];
      if (current) {
        setExpandedSeason((prev) => prev ?? current.seasonNumber);
      }
    };

    const cached = titleCacheKey ? getCached<TitlePayload>(titleCacheKey) : null;
    if (cached) {
      setDetails(cached.details);
      setTracked(cached.tracked || null);
      pickSeason(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      setError(null);
      const res = await fetch(titleUrl);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.error || "Failed to load title details");
      }

      setDetails(json.data.details);
      setTracked(json.data.tracked || null);
      pickSeason(json.data);
    } catch (err) {
      if (!cached) setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [mediaType, titleUrl, titleCacheKey]);

  // Keep the cached copy in step with every change made on this page
  useEffect(() => {
    if (titleCacheKey && details) {
      setCached(titleCacheKey, { details, tracked });
    }
  }, [titleCacheKey, details, tracked]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        void loadTitle();
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadTitle]);

  // Fetch Season episodes when expanding
  const fetchSeasonEpisodes = useCallback(
    async (seasonNumber: number) => {
      if (seasonsCache[seasonNumber] || loadingSeason === seasonNumber) return;

      // Episode lists are public TMDB data, so one cache entry serves every account
      const seasonUrl = `/api/tmdb/season?tvId=${tmdbId}&season=${seasonNumber}`;
      const seasonKey = cacheKey("tmdb", seasonUrl);
      const cachedSeason = getCached<TmdbSeasonDetail>(seasonKey);
      if (cachedSeason) {
        setSeasonsCache((prev) => ({ ...prev, [seasonNumber]: cachedSeason }));
      }

      try {
        if (!cachedSeason) setLoadingSeason(seasonNumber);
        const res = await fetch(seasonUrl);
        const json = await res.json();

        if (res.ok && json.success) {
          setCached(seasonKey, json.data);
          setSeasonsCache((prev) => ({
            ...prev,
            [seasonNumber]: json.data,
          }));
        }
      } catch (err) {
        console.warn(`Failed to fetch season ${seasonNumber}:`, err);
      } finally {
        setLoadingSeason(null);
      }
    },
    [tmdbId, seasonsCache, loadingSeason]
  );

  useEffect(() => {
    let mounted = true;
    if (expandedSeason !== null && mediaType === "tv") {
      queueMicrotask(() => {
        if (mounted) {
          void fetchSeasonEpisodes(expandedSeason);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [expandedSeason, mediaType, fetchSeasonEpisodes]);

  // --- User Action Handlers ---

  // Add to library
  const handleAddToLibrary = async () => {
    if (!details) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          title: details.title,
          posterPath: details.posterPath,
          yearRange: details.yearRange,
          notify: mediaType === "tv",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTracked(json.data.tracked);
      }
    } catch {
      alert("Failed to track title");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove from library
  const handleRemoveFromLibrary = async () => {
    if (!confirm(`Remove "${details?.title}" from your library?`)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tracking?tmdbId=${tmdbId}&mediaType=${mediaType}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTracked(null);
      }
    } catch {
      alert("Failed to remove title");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle movie watched
  const handleToggleMovieWatched = async () => {
    if (!tracked) {
      await handleAddToLibrary();
    }
    try {
      const res = await fetch("/api/tracking/movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });
      if (res.ok) {
        const json = await res.json();
        setTracked(json.data.item);
      }
    } catch {
      alert("Failed to toggle movie status");
    }
  };

  // Toggle TV Episode
  const handleToggleEpisode = async (seasonNum: number, epNum: number) => {
    if (!tracked) {
      await handleAddToLibrary();
    }

    try {
      const totalAired = details?.totalEpisodes || 0;
      const res = await fetch("/api/tracking/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          totalAiredEpisodes: totalAired,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTracked(json.data.item);
      }
    } catch {
      alert("Failed to toggle episode");
    }
  };

  // Mark entire season as watched
  const handleMarkSeasonWatched = async (seasonNum: number, maxAired: number) => {
    if (!tracked) {
      await handleAddToLibrary();
    }

    try {
      const totalAired = details?.totalEpisodes || 0;
      const res = await fetch("/api/tracking/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          seasonNumber: seasonNum,
          maxAiredEpisode: maxAired,
          totalAiredSeriesEpisodes: totalAired,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTracked(json.data.item);
      }
    } catch {
      alert("Failed to mark season as watched");
    }
  };

  // Mark all episodes up to target
  const handleMarkAllUpToHere = async (targetSeason: number, targetEp: number) => {
    if (!tracked) {
      await handleAddToLibrary();
    }

    try {
      const seasonEpisodeCounts: Record<string, number> = {};
      details?.seasonsSummary?.forEach((s) => {
        seasonEpisodeCounts[s.seasonNumber.toString()] = s.episodeCount;
      });

      const totalAired = details?.totalEpisodes || 0;
      const res = await fetch("/api/tracking/all-up-to-here", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          targetSeason,
          targetEpisode: targetEp,
          seasonEpisodeCounts,
          totalAiredSeriesEpisodes: totalAired,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setTracked(json.data.item);
      }
    } catch {
      alert("Failed to mark up to this episode");
    }
  };

  // 0-10 Rating Handler (accepts up to 2 decimal places or null)
  const handleSaveRating = async (newRating: number | null) => {
    if (!tracked) {
      await handleAddToLibrary();
    }
    const cleanRating =
      newRating !== null
        ? Math.min(10, Math.max(0, Math.round(newRating * 100) / 100))
        : null;

    setIsSavingRating(true);
    try {
      const res = await fetch("/api/tracking/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          rating: cleanRating,
        }),
      });

      if (res.ok) {
        setTracked((prev) => (prev ? { ...prev, rating: cleanRating } : null));
        setIsRatingModalOpen(false);
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update rating");
      }
    } catch {
      alert("Failed to update rating");
    } finally {
      setIsSavingRating(false);
    }
  };

  // Notification Toggle
  const handleToggleNotify = async () => {
    if (!tracked) return;
    const nextNotify = !tracked.notify;
    try {
      const res = await fetch("/api/tracking/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          notify: nextNotify,
        }),
      });
      if (res.ok) {
        setTracked((prev) => (prev ? { ...prev, notify: nextNotify } : null));
      }
    } catch {
      alert("Failed to update notifications");
    }
  };

  // Override Selector (Normal, Dropped, On Hold)
  const handleOverride = async (overrideVal: "dropped" | "on_hold" | null) => {
    if (!tracked) return;
    try {
      const res = await fetch("/api/tracking/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          override: overrideVal,
        }),
      });
      if (res.ok) {
        setTracked((prev) => (prev ? { ...prev, override: overrideVal } : null));
      }
    } catch {
      alert("Failed to update status override");
    }
  };

  // Fetch Franchise Collection Parts
  const fetchCollection = useCallback(async (collectionId: number) => {
    setIsLoadingCollection(true);
    try {
      const res = await fetch(`/api/tmdb/collection?id=${collectionId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setCollectionDetail(json.data);
          const parts: CollectionPart[] = json.data.parts || [];
          const unwatched = parts.filter((p) => !p.isWatched).map((p) => p.id);
          setSelectedPartIds(new Set(unwatched.length > 0 ? unwatched : parts.map((p) => p.id)));
        }
      }
    } catch (err) {
      console.warn("Failed to load franchise collection:", err);
    } finally {
      setIsLoadingCollection(false);
    }
  }, []);

  // Toggle selection of a single part in the franchise collection
  const handleToggleSelectPart = (partId: number) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  };

  // Toggle select all parts in franchise
  const handleToggleSelectAllParts = () => {
    if (!collectionDetail) return;
    if (selectedPartIds.size === collectionDetail.parts.length) {
      setSelectedPartIds(new Set());
    } else {
      setSelectedPartIds(new Set(collectionDetail.parts.map((p) => p.id)));
    }
  };

  // Mark only selected parts in franchise collection as watched
  const handleMarkSelectedCollectionWatched = async () => {
    if (!collectionDetail || selectedPartIds.size === 0) return;
    setIsUpdatingCollectionParts(true);

    try {
      const selectedParts = collectionDetail.parts.filter((p) => selectedPartIds.has(p.id));
      const res = await fetch("/api/tracking/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_items",
          items: selectedParts.map((p) => ({
            tmdbId: p.id,
            mediaType: "movie",
            title: p.title,
            posterPath: p.posterPath,
            yearRange: p.yearRange,
            status: "watched",
          })),
        }),
      });

      if (res.ok) {
        setCollectionDetail((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            parts: prev.parts.map((p) =>
              selectedPartIds.has(p.id) ? { ...p, isWatched: true, status: "watched" } : p
            ),
          };
        });

        if (selectedPartIds.has(tmdbId)) {
          setTracked((prev) => (prev ? { ...prev, status: "watched" } : null));
        }

        alert(`Marked ${selectedParts.length} franchise movie${selectedParts.length === 1 ? "" : "s"} as watched!`);
      } else {
        const json = await res.json();
        alert(json.error || "Failed to mark selected movies");
      }
    } catch {
      alert("Failed to mark selected movies");
    } finally {
      setIsUpdatingCollectionParts(false);
    }
  };

  // Mark whole collection as watched
  const handleMarkEntireCollectionWatched = async (collectionId: number) => {
    if (!confirm(`Mark all movies across this franchise collection as watched?`)) return;
    setIsMarkingCollection(true);
    try {
      const res = await fetch("/api/tracking/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collection_watched",
          collectionId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || "Franchise collection marked as watched!");
        if (collectionDetail) {
          setCollectionDetail((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              parts: prev.parts.map((p) => ({ ...p, isWatched: true, status: "watched" })),
            };
          });
        }
        await loadTitle();
      } else {
        alert(json.error || "Failed to mark collection");
      }
    } catch {
      alert("Failed to mark collection");
    } finally {
      setIsMarkingCollection(false);
    }
  };

  // Helper to check if an episode is watched
  const checkIsWatched = (seasonNum: number, epNum: number): boolean => {
    if (!tracked?.watchedEpisodes) return false;
    const s = tracked.watchedEpisodes.find((entry) => entry.season === seasonNum);
    if (!s) return false;
    return isEpisodeInRange(s.ranges, epNum);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-[#4fd27f] animate-spin" />
        <p className="text-xs text-[#b7a9bc]">Loading title details...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-4 max-w-lg mx-auto pt-8">
        <div className="p-5 rounded-2xl bg-[#1f1424] border border-[#ff8a80]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#ff8a80] mx-auto" />
          <h2 className="text-sm font-semibold text-cream">Unable to Load Title</h2>
          <p className="text-xs text-[#ff8a80]">{error || "Title not found"}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl bg-plum-raised hover:bg-plum-line text-xs font-semibold text-cream"
            >
              Go Back
            </button>
            <Link
              href="/profile"
              className="btn-primary px-4 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-xs font-semibold text-ink"
            >
              Verify API Key in Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isMovie = mediaType === "movie";
  const regularSeasons = details.seasonsSummary?.filter((s) => s.seasonNumber > 0) || [];
  const specialsSeason = details.seasonsSummary?.find((s) => s.seasonNumber === 0);
  const hasRating = tracked?.rating !== undefined && tracked?.rating !== null;

  // Next episode to watch: first aired, unwatched episode of the first unfinished season
  const nextSeasonSummary = regularSeasons.find(
    (s) => countWatchedInSeason(tracked, s.seasonNumber) < s.episodeCount
  );
  const nextSeasonDetail = nextSeasonSummary ? seasonsCache[nextSeasonSummary.seasonNumber] : undefined;
  const upNext = nextSeasonDetail?.episodes.find(
    (ep) => ep.isAired && !checkIsWatched(nextSeasonDetail.seasonNumber, ep.episodeNumber)
  );
  const totalWatched = regularSeasons.reduce((sum, s) => sum + countWatchedInSeason(tracked, s.seasonNumber), 0);

  const metaLine = [
    isMovie ? "FILM" : "SERIES",
    details.yearRange,
    details.ageRating,
    !isMovie && details.totalSeasons ? `${details.totalSeasons} ${details.totalSeasons === 1 ? "SEASON" : "SEASONS"}` : null,
    details.averageRuntimeMinutes ? `${details.averageRuntimeMinutes} MIN` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const selectedSeasonDetail = expandedSeason !== null ? seasonsCache[expandedSeason] : undefined;
  const selectedFirstUnwatched = selectedSeasonDetail?.episodes.find(
    (ep) => ep.isAired && !checkIsWatched(selectedSeasonDetail.seasonNumber, ep.episodeNumber)
  )?.episodeNumber;

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Hero: poster, poster-style title, meta line and overview */}
      <section className="-mx-4 md:-mx-14 -mt-6 md:-mt-10 bg-plum px-4 md:px-14 pt-4 md:pt-8 pb-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="self-start h-11 -ml-2 px-2 inline-flex items-center gap-1 text-sm font-semibold text-smoke hover:text-cream"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2.4} />
          Back
        </button>

        <div className="flex flex-col sm:flex-row gap-6 md:gap-10 sm:items-end">
          <div className="relative w-[120px] sm:w-[160px] md:w-[220px] aspect-[2/3] rounded-md overflow-hidden bg-eggplant shrink-0 shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
            {details.posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w342${details.posterPath}`}
                alt={details.title}
                fill
                sizes="220px"
                className="object-cover"
                priority
              />
            ) : (
              <span className="absolute inset-0 p-4 flex items-end font-display font-black text-4xl leading-[0.88]">
                {details.title}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3.5">
            <span className="font-mono text-xs md:text-[13px] tracking-[0.12em] text-lilac">{metaLine}</span>
            <h1 className="font-display font-black text-5xl sm:text-6xl md:text-[96px] leading-[0.85] break-words">
              {details.title}
            </h1>
            {details.overview && (
              <p className="max-w-[640px] text-[15px] md:text-base leading-relaxed text-[#d9cedc]">{details.overview}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-smoke">
              {details.genres.length > 0 && <span>{details.genres.join(" / ").toUpperCase()}</span>}
              {details.status && <span className="text-green">{details.status.toUpperCase()}</span>}
            </div>
          </div>
        </div>
      </section>

      {/* Action deck: the main action first, then rating, status and alerts */}
      <section aria-label="Your tracking" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!tracked ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-[14px] bg-plum p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-display font-extrabold text-3xl">Not on your lists yet</span>
              <span className="text-sm text-smoke">
                {isMovie ? "Save it for later or mark it as seen." : "Add it, or tick an episode below to start tracking."}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {isMovie && (
                <button
                  type="button"
                  onClick={handleToggleMovieWatched}
                  className="btn-outline h-12 px-5 rounded-[10px] border border-green text-green font-bold flex items-center gap-2 ios-press"
                >
                  <Check className="w-4 h-4" strokeWidth={2.6} />
                  I&rsquo;ve seen it
                </button>
              )}
              <button
                type="button"
                onClick={handleAddToLibrary}
                disabled={isSubmitting}
                className="btn-primary h-12 px-6 rounded-[10px] bg-green text-ink font-bold flex items-center gap-2 ios-press disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={2.6} />}
                Want to watch
              </button>
            </div>
          </div>
        ) : (
          <>
            {isMovie ? (
              <div
                className={`md:col-span-2 xl:col-span-3 rounded-[14px] flex flex-wrap items-center justify-between gap-4 p-5 md:p-6 ${
                  tracked.status === "watched" ? "bg-plum" : "bg-green text-ink"
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-semibold tracking-[0.12em]">
                    {tracked.status === "watched" ? "IN YOUR WATCHED LIST" : "ON YOUR WATCHLIST"}
                  </span>
                  <span className="font-display font-black text-4xl leading-none">
                    {tracked.status === "watched" ? "Seen it" : "Watched it yet?"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleMovieWatched}
                  className={`btn-ink h-[52px] px-6 rounded-[10px] font-bold flex items-center gap-2.5 ios-press ${
                    tracked.status === "watched" ? "border border-plum-line text-smoke" : "bg-ink text-green"
                  }`}
                >
                  {tracked.status === "watched" ? (
                    "Mark unwatched"
                  ) : (
                    <>
                      <Check className="w-[18px] h-[18px]" strokeWidth={2.6} />
                      Mark watched
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="md:col-span-2 xl:col-span-3 rounded-[14px] bg-green text-ink flex flex-wrap items-stretch overflow-hidden">
                <div className="flex-1 min-w-[220px] p-5 md:p-6 flex flex-col gap-1.5">
                  {upNext ? (
                    <>
                      <span className="font-mono text-xs font-semibold tracking-[0.12em]">
                        UP NEXT · S{String(upNext.seasonNumber).padStart(2, "0")} E{String(upNext.episodeNumber).padStart(2, "0")}
                      </span>
                      <span className="font-display font-black text-3xl md:text-[40px] leading-[0.95]">{upNext.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-xs font-semibold tracking-[0.12em]">ALL CAUGHT UP</span>
                      <span className="font-display font-black text-3xl md:text-[40px] leading-[0.95]">
                        {details.nextEpisodeToAir
                          ? `Next airs ${details.nextEpisodeToAir.airDate}`
                          : nextSeasonSummary && !nextSeasonDetail
                          ? "Loading…"
                          : "Nothing left to watch"}
                      </span>
                    </>
                  )}
                  <span className="text-sm font-medium">
                    {totalWatched} of {details.totalEpisodes ?? "?"} episodes watched
                  </span>
                </div>
                {upNext && (
                  <>
                    <div className="hidden sm:block border-l-2 border-dashed border-ink/35" aria-hidden="true" />
                    <div className="p-5 md:p-6 pt-0 sm:pt-5 flex items-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEpisode(upNext.seasonNumber, upNext.episodeNumber)}
                        className="btn-ink h-[52px] px-6 rounded-[10px] bg-ink text-green font-bold flex items-center gap-2.5 ios-press"
                      >
                        <Check className="w-[18px] h-[18px]" strokeWidth={2.6} />
                        Mark watched
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="rounded-[14px] bg-plum p-5 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Your rating</span>
                <span>
                  <span className="font-display font-black text-[40px] leading-none text-green">
                    {hasRating ? tracked.rating : "–"}
                  </span>
                  <span className="font-mono text-[13px] text-smoke"> /10</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRatingInput(hasRating ? String(tracked.rating) : "");
                  setIsRatingModalOpen(true);
                }}
                className="btn-quiet h-11 px-4 rounded-[10px] border border-plum-line text-sm font-semibold hover:border-green ios-press"
              >
                {hasRating ? "Change" : "Rate it"}
              </button>
            </div>

            <div className="rounded-[14px] bg-plum p-5 flex flex-col gap-3">
              <span className="text-sm font-semibold">Status</span>
              <div role="group" aria-label="Status" className="grid grid-cols-3 gap-1 p-1 rounded-[10px] bg-ink">
                {([
                  [null, tracked.status === "want_to_watch" ? "Want to watch" : tracked.status === "watched" ? "Watched" : "Watching"],
                  ["on_hold", "On hold"],
                  ["dropped", "Dropped"],
                ] as const).map(([value, label]) => {
                  const active = (tracked.override ?? null) === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleOverride(value)}
                      className={`h-10 rounded-[7px] text-[13px] font-semibold transition-colors ${
                        active ? "bg-eggplant text-cream" : "text-smoke hover:text-cream"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {!isMovie && <span className="text-xs text-dim">The first option follows your episodes automatically.</span>}
            </div>

            {!isMovie && (
              <div className="rounded-[14px] bg-plum p-5 flex items-center gap-4">
                <span className="flex-1 flex flex-col gap-1">
                  <span className="text-sm font-semibold">New episode alerts</span>
                  <span className="text-xs text-smoke">Push to your phone when an episode airs</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(tracked.notify)}
                  aria-label="New episode alerts"
                  onClick={handleToggleNotify}
                  className={`w-14 h-8 rounded-full p-[3px] flex transition-colors ${
                    tracked.notify ? "bg-green justify-end" : "bg-plum-line justify-start"
                  }`}
                >
                  <span className="w-[26px] h-[26px] rounded-full bg-cream" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
      {/* Movie Franchise Collection Collapsible Dropdown */}
      {isMovie && details.belongsToCollection && (
        <div className="rounded-2xl overflow-hidden bg-[#1f1424] border border-plum-line shadow-lg transition-all">
          {/* Accordion Trigger Header */}
          <div
            onClick={() => {
              const nextState = !isCollectionExpanded;
              setIsCollectionExpanded(nextState);
              if (nextState && !collectionDetail && details.belongsToCollection) {
                void fetchCollection(details.belongsToCollection.id);
              }
            }}
            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-plum-raised transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#4fd27f] uppercase tracking-wider">
                  Franchise Collection
                </span>
                {collectionDetail && (
                  <span className="px-2 py-0.5 rounded-full bg-[#4fd27f]/15 text-[#4fd27f] text-[10px] font-bold border border-[#4fd27f]/30">
                    {collectionDetail.parts.filter((p) => p.isWatched).length} / {collectionDetail.parts.length} Watched
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-cream flex items-center gap-2">
                <span>{details.belongsToCollection.name}</span>
              </h3>
              <p className="text-xs text-[#b7a9bc]">
                Tap to view all franchise movies and mark all or select titles as watched.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-plum-raised text-[#b7a9bc] hover:text-cream transition-colors shrink-0">
              {isCollectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Expanded Dropdown Content */}
          {isCollectionExpanded && (
            <div className="border-t border-plum-line p-4 sm:p-5 space-y-4 bg-ink/">
              {isLoadingCollection ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-5 h-5 text-[#4fd27f] animate-spin mx-auto" />
                  <p className="text-xs text-[#b7a9bc]">Loading franchise movies...</p>
                </div>
              ) : collectionDetail ? (
                <div className="space-y-3">
                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-plum-line">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleSelectAllParts}
                        className="px-2.5 py-1 rounded-lg bg-plum-raised hover:bg-plum-raised text-xs font-semibold text-cream flex items-center gap-1.5 transition-colors"
                      >
                        {selectedPartIds.size === collectionDetail.parts.length ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-[#4fd27f]" />
                            <span>Deselect All</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-[#b7a9bc]" />
                            <span>Select All</span>
                          </>
                        )}
                      </button>
                      <span className="text-xs text-[#b7a9bc]">
                        {selectedPartIds.size} of {collectionDetail.parts.length} selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkSelectedCollectionWatched}
                        disabled={isUpdatingCollectionParts || selectedPartIds.size === 0}
                        className="btn-primary px-3 py-1.5 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] disabled:opacity-40 text-ink text-xs font-bold flex items-center gap-1.5 transition-all ios-press"
                      >
                        {isUpdatingCollectionParts ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Mark Selected Watched</span>
                      </button>

                      <button
                        onClick={() => handleMarkEntireCollectionWatched(details.belongsToCollection!.id)}
                        disabled={isMarkingCollection}
                        className="btn-tint px-3 py-1.5 rounded-xl bg-[#4fd27f]/15 hover:bg-[#4fd27f]/25 border border-[#4fd27f]/30 text-[#4fd27f] text-xs font-bold flex items-center gap-1.5 transition-all ios-press disabled:opacity-40"
                      >
                        {isMarkingCollection ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>Mark All Watched</span>
                      </button>
                    </div>
                  </div>

                  {/* Movies List in Franchise */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {collectionDetail.parts.map((part) => {
                      const isSelected = selectedPartIds.has(part.id);
                      const isCurrent = part.id === tmdbId;

                      return (
                        <div
                          key={part.id}
                          onClick={() => handleToggleSelectPart(part.id)}
                          className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[#4fd27f]/[0.08] border-[#4fd27f]/40"
                              : "bg-[#160e19] border-plum-line hover:border-plum-line"
                          } ${isCurrent ? "ring-1 ring-[#b48cc0]/50" : ""}`}
                        >
                          {/* Checkbox */}
                          <div className="p-1 text-cream shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#4fd27f]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#8a7c90]" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          <div className="relative w-9 h-13 rounded-lg overflow-hidden bg-[#2c1b33] shrink-0 border border-plum-line">
                            {part.posterPath ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${part.posterPath}`}
                                alt={part.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#b7a9bc]">
                                <Film className="w-3.5 h-3.5 opacity-40" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4
                                className="text-xs font-bold text-cream truncate"
                                title={part.title}
                              >
                                {part.title}
                              </h4>
                              {isCurrent && (
                                <span className="px-1 py-0.2 rounded bg-[#b48cc0]/20 text-[#b48cc0] text-[9px] font-bold">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#b7a9bc] mt-0.5">
                              {part.yearRange || "TBA"}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {part.isWatched ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#4fd27f]/15 border border-[#4fd27f]/30 text-[#4fd27f] text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Watched</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-plum-raised border border-plum-line text-[#b7a9bc] text-[10px] font-medium">
                                Unwatched
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#ff8a80]">Unable to load franchise collection.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Episode checklist: season tabs, progress strip, one row per episode */}
      {!isMovie && regularSeasons.length > 0 && (
        <section aria-labelledby="episodes-heading" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="episodes-heading" className="font-display font-black text-[40px] md:text-[44px] leading-none">
              Episodes
            </h2>
            <div role="tablist" aria-label="Seasons" className="flex gap-2 overflow-x-auto max-w-full pb-1">
              {regularSeasons.map((season) => {
                const active = expandedSeason === season.seasonNumber;
                const watched = countWatchedInSeason(tracked, season.seasonNumber);
                const complete = watched >= season.episodeCount && season.episodeCount > 0;
                return (
                  <button
                    key={season.seasonNumber}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setExpandedSeason(season.seasonNumber)}
                    className={`btn-quiet min-w-[88px] h-14 px-3.5 rounded-[10px] border flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors ${
                      active ? "bg-plum-raised border-lilac" : "border-plum-line hover:border-lilac hover:bg-plum"
                    }`}
                  >
                    <span className="font-display font-extrabold text-xl leading-none">Season {season.seasonNumber}</span>
                    <span className={`font-mono text-[11px] ${complete ? "text-green" : "text-smoke"}`}>
                      {complete ? "COMPLETE" : `${watched}/${season.episodeCount}`}
                    </span>
                  </button>
                );
              })}
              {specialsSeason && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={expandedSeason === 0}
                  onClick={() => setExpandedSeason(0)}
                  className={`btn-quiet min-w-[88px] h-14 px-3.5 rounded-[10px] border flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors ${
                    expandedSeason === 0 ? "bg-plum-raised border-lilac" : "border-plum-line hover:border-lilac"
                  }`}
                >
                  <span className="font-display font-extrabold text-xl leading-none">Specials</span>
                  <span className="font-mono text-[11px] text-smoke">{specialsSeason.episodeCount} EPS</span>
                </button>
              )}
            </div>
          </div>

          {expandedSeason !== null && !selectedSeasonDetail && loadingSeason === expandedSeason ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 text-green animate-spin" />
            </div>
          ) : selectedSeasonDetail ? (
            <>
              {expandedSeason === 0 ? (
                <p className="text-sm text-smoke">Specials don&rsquo;t count towards your series progress.</p>
              ) : (
                <SeasonProgress
                  watched={countWatchedInSeason(tracked, selectedSeasonDetail.seasonNumber)}
                  season={selectedSeasonDetail}
                  onMarkSeason={() =>
                    handleMarkSeasonWatched(selectedSeasonDetail.seasonNumber, selectedSeasonDetail.airedEpisodesCount)
                  }
                />
              )}

              <ol className="flex flex-col">
                {selectedSeasonDetail.episodes.map((ep) => {
                  const isWatched = checkIsWatched(selectedSeasonDetail.seasonNumber, ep.episodeNumber);
                  const canMarkUpTo =
                    expandedSeason !== 0 &&
                    ep.isAired &&
                    !isWatched &&
                    selectedFirstUnwatched !== undefined &&
                    ep.episodeNumber > selectedFirstUnwatched;
                  return (
                    <li
                      key={ep.episodeNumber}
                      className={`flex items-center gap-3 md:gap-[18px] py-2.5 px-2 -mx-2 rounded-lg border-b border-[#241829] hover:bg-plum transition-colors ${
                        ep.isAired ? "" : "opacity-55"
                      }`}
                    >
                      {ep.isAired ? (
                        <button
                          type="button"
                          aria-pressed={isWatched}
                          aria-label={`Episode ${ep.episodeNumber}, ${isWatched ? "watched" : "not watched"}`}
                          onClick={() => handleToggleEpisode(selectedSeasonDetail.seasonNumber, ep.episodeNumber)}
                          className={`w-11 h-11 shrink-0 rounded-[10px] border-2 flex items-center justify-center transition-colors ios-press ${
                            isWatched ? "bg-green border-green" : "border-eggplant hover:border-green"
                          }`}
                        >
                          {isWatched && <Check className="w-5 h-5 text-ink" strokeWidth={3} />}
                        </button>
                      ) : (
                        <span
                          className="w-11 h-11 shrink-0 rounded-[10px] border-2 border-dashed border-plum-line flex items-center justify-center"
                          title="Not aired yet"
                        >
                          <Lock className="w-[18px] h-[18px] text-dim" />
                        </span>
                      )}
                      <span
                        className={`w-9 md:w-12 shrink-0 font-display font-extrabold text-[22px] md:text-[26px] ${
                          isWatched ? "text-eggplant" : ""
                        }`}
                      >
                        {String(ep.episodeNumber).padStart(2, "0")}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="font-semibold text-[15px] truncate">{ep.name}</span>
                        <span className="font-mono text-[11px] md:text-xs text-smoke">
                          {ep.airDate ? `${ep.isAired ? "AIRED" : "AIRS"} ${ep.airDate}` : "TBA"}
                          {ep.runtime ? ` · ${ep.runtime} MIN` : ""}
                        </span>
                      </span>
                      {canMarkUpTo && (
                        <button
                          type="button"
                          onClick={() => handleMarkAllUpToHere(selectedSeasonDetail.seasonNumber, ep.episodeNumber)}
                          className="btn-quiet hidden sm:block h-9 px-3.5 rounded-lg border border-plum-line text-smoke hover:text-cream text-[13px] font-semibold shrink-0"
                        >
                          Watched up to here
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="text-sm text-smoke">Couldn&rsquo;t load this season&rsquo;s episodes.</p>
          )}
        </section>
      )}

      {tracked && (
        <button
          type="button"
          onClick={handleRemoveFromLibrary}
          disabled={isSubmitting}
          className="btn-danger self-start h-10 text-danger text-sm font-semibold hover:underline"
        >
          Remove from my lists
        </button>
      )}

      {/* 0-10 Rating Modal */}
      {isRatingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/ backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#1f1424] border border-plum-line p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#4fd27f] fill-[#4fd27f]" />
                <h3 className="text-base font-extrabold text-cream">Rate Title</h3>
              </div>
              <button
                onClick={() => setIsRatingModalOpen(false)}
                className="p-1 rounded-full text-[#b7a9bc] hover:text-cream"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#b7a9bc]">
              Enter a score from <strong className="text-cream">0.00 to 10.00</strong> (decimals supported up to 2 places).
            </p>

            {/* Custom Input */}
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  placeholder="e.g. 8.5 or 9.25"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#2c1b33] border border-plum-line text-cream font-bold text-sm focus:outline-none focus:border-[#4fd27f] transition-colors"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#b7a9bc]">
                  / 10
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <p className="text-[11px] font-semibold text-[#b7a9bc] mb-1.5">Quick Presets</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[5.0, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRatingInput(String(preset))}
                    className="btn-quiet py-1 rounded-lg bg-plum-raised hover:bg-plum-line text-xs font-semibold text-cream border border-plum-line transition-colors"
                  >
                    {preset.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-plum-line">
              {tracked?.rating !== undefined && tracked?.rating !== null ? (
                <button
                  type="button"
                  onClick={() => handleSaveRating(null)}
                  disabled={isSavingRating}
                  className="btn-danger px-3 py-2 rounded-xl bg-[#ff8a80]/15 hover:bg-[#ff8a80]/25 text-[#ff8a80] text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-plum-raised hover:bg-plum-raised text-xs font-semibold text-[#b7a9bc] hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const num = parseFloat(ratingInput);
                    if (isNaN(num)) {
                      alert("Please enter a valid number between 0 and 10");
                      return;
                    }
                    if (num < 0 || num > 10) {
                      alert("Rating must be between 0 and 10");
                      return;
                    }
                    void handleSaveRating(num);
                  }}
                  disabled={isSavingRating || !ratingInput.trim()}
                  className="px-4 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingRating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Rating</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

