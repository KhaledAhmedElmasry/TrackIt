"use client";

import { useState, useEffect, useCallback, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Star,
  Bell,
  BellOff,
  Film,
  Tv,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { TmdbTitleDetail, TmdbSeasonDetail } from "@/lib/services/tmdb.service";
import { TrackedItemDocument } from "@/lib/models/types";
import { isEpisodeInRange } from "@/lib/utils/ranges";

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

  const [details, setDetails] = useState<TmdbTitleDetail | null>(null);
  const [tracked, setTracked] = useState<TrackedItemDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Seasons episode cache: seasonNumber -> TmdbSeasonDetail
  const [seasonsCache, setSeasonsCache] = useState<Record<number, TmdbSeasonDetail>>({});
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null);
  const [isSpecialsExpanded, setIsSpecialsExpanded] = useState(false);

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
  const loadTitle = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/tmdb/title?id=${tmdbId}&type=${mediaType}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load title details");
      }

      setDetails(json.data.details);
      setTracked(json.data.tracked || null);

      // Auto expand Season 1 by default for series
      if (mediaType === "tv" && json.data.details.seasonsSummary?.length) {
        const firstRegular = json.data.details.seasonsSummary.find(
          (s: { seasonNumber: number }) => s.seasonNumber > 0
        );
        if (firstRegular) {
          setExpandedSeason(firstRegular.seasonNumber);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [tmdbId, mediaType]);

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

      try {
        setLoadingSeason(seasonNumber);
        const res = await fetch(`/api/tmdb/season?tvId=${tmdbId}&season=${seasonNumber}`);
        const json = await res.json();

        if (res.ok && json.success) {
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
        <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
        <p className="text-xs text-[#8e8e93]">Loading title details...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-4 max-w-lg mx-auto pt-8">
        <div className="p-5 rounded-2xl bg-[#2a0e0e] border border-[#ff453a]/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#ff453a] mx-auto" />
          <h2 className="text-sm font-semibold text-white">Unable to Load Title</h2>
          <p className="text-xs text-[#ff9f98]">{error || "Title not found"}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
            >
              Go Back
            </button>
            <Link
              href="/profile"
              className="px-4 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-xs font-semibold text-white"
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

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0a84ff] hover:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {tracked && (
          <button
            onClick={handleRemoveFromLibrary}
            className="p-1.5 rounded-full text-[#8e8e93] hover:text-[#ff453a] hover:bg-white/5 transition-colors"
            title="Remove from library"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hero Header Card with Backdrop Blur */}
      <div className="relative rounded-3xl overflow-hidden bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)] shadow-2xl">
        {/* Backdrop Image */}
        {details.backdropPath && (
          <div className="absolute inset-0 h-56 sm:h-64 w-full overflow-hidden opacity-30">
            <Image
              src={`https://image.tmdb.org/t/p/w780${details.backdropPath}`}
              alt=""
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1c1c1e]/80 to-[#1c1c1e]" />
          </div>
        )}

        <div className="relative p-5 sm:p-6 pt-24 sm:pt-28 flex flex-col sm:flex-row gap-5 items-start">
          {/* Poster Card */}
          <div className="relative w-28 sm:w-36 aspect-[2/3] rounded-2xl overflow-hidden bg-[#141416] border border-white/10 shadow-2xl shrink-0 mx-auto sm:mx-0">
            {details.posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w342${details.posterPath}`}
                alt={details.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8e8e93]">
                {isMovie ? <Film className="w-8 h-8 opacity-40" /> : <Tv className="w-8 h-8 opacity-40" />}
              </div>
            )}
          </div>

          {/* Details Content */}
          <div className="flex-1 space-y-3 w-full">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                  {isMovie ? "Movie" : "Series"}
                </span>

                {details.ageRating && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white border border-white/10">
                    {details.ageRating}
                  </span>
                )}

                <span className="text-xs text-[#8e8e93] font-medium">
                  {isMovie
                    ? (details.releaseDate ? `Released: ${details.releaseDate}` : details.yearRange)
                    : details.yearRange}
                </span>

                {details.status && (
                  <span className="text-xs text-[#0a84ff] font-semibold">
                    • {details.status}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {details.title}
              </h1>

              {details.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {details.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-0.5 rounded-lg bg-[#2c2c2e] text-[11px] font-medium text-[#8e8e93]"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Metadata Row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#8e8e93] pt-1">
              {details.averageRuntimeMinutes && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isMovie
                      ? `${details.averageRuntimeMinutes}m`
                      : `~${details.averageRuntimeMinutes}m / ep`}
                  </span>
                </div>
              )}

              {!isMovie && details.totalEpisodes !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {details.totalSeasons} {details.totalSeasons === 1 ? "Season" : "Seasons"} • {details.totalEpisodes} Episodes
                  </span>
                </div>
              )}

              {!isMovie && details.nextEpisodeToAir && (
                <div className="flex items-center gap-1.5 text-[#32d74b]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Next: S{details.nextEpisodeToAir.seasonNumber}E{details.nextEpisodeToAir.episodeNumber} ({details.nextEpisodeToAir.airDate})
                  </span>
                </div>
              )}
            </div>

            {/* Overview */}
            {details.overview && (
              <p className="text-xs sm:text-sm text-[#8e8e93] leading-relaxed pt-1">
                {details.overview}
              </p>
            )}
          </div>
        </div>

        {/* Tracking & Actions Strip */}
        <div className="p-4 sm:p-5 bg-black/40 border-t border-[rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-4">
          {/* Status or Add Button */}
          <div>
            {!tracked ? (
              <button
                onClick={handleAddToLibrary}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add to Watchlist</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    tracked.status === "watched"
                      ? "bg-[#32d74b]/15 text-[#32d74b] border border-[#32d74b]/30"
                      : tracked.status === "currently_watching"
                      ? "bg-[#0a84ff]/15 text-[#0a84ff] border border-[#0a84ff]/30"
                      : "bg-[#ff9f0a]/15 text-[#ff9f0a] border border-[#ff9f0a]/30"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="capitalize">{tracked.status.replace(/_/g, " ")}</span>
                </div>

                {/* Status Override Selector */}
                <select
                  value={tracked.override || "normal"}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleOverride(val === "normal" ? null : (val as "dropped" | "on_hold"));
                  }}
                  className="bg-[#2c2c2e] text-[#8e8e93] hover:text-white text-xs font-semibold rounded-xl px-2.5 py-1 border border-white/10 focus:outline-none"
                >
                  <option value="normal">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>
            )}
          </div>

          {/* Interactive Controls (Rating & Notifications) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* 0-10 Rating Button */}
            <button
              onClick={() => {
                setRatingInput(
                  tracked?.rating !== undefined && tracked?.rating !== null
                    ? String(tracked.rating)
                    : ""
                );
                setIsRatingModalOpen(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ios-press ${
                tracked?.rating !== undefined && tracked?.rating !== null
                  ? "bg-[#ffd60a]/15 text-[#ffd60a] border-[#ffd60a]/30 shadow-sm"
                  : "bg-[#2c2c2e]/60 text-[#8e8e93] hover:text-[#ffd60a] border-white/10"
              }`}
              title="Rate this title (0.00 to 10.00)"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  tracked?.rating !== undefined && tracked?.rating !== null
                    ? "fill-[#ffd60a] text-[#ffd60a]"
                    : "text-[#ffd60a]"
                }`}
              />
              <span>
                {tracked?.rating !== undefined && tracked?.rating !== null
                  ? `${tracked.rating}/10`
                  : "Rate / 10"}
              </span>
            </button>

            {/* Notification Bell (for Series) */}
            {!isMovie && (
              <button
                onClick={handleToggleNotify}
                className={`p-2 rounded-xl border transition-all ${
                  tracked?.notify
                    ? "bg-[#0a84ff]/15 border-[#0a84ff]/40 text-[#0a84ff]"
                    : "bg-[#2c2c2e]/60 border-white/10 text-[#8e8e93] hover:text-white"
                }`}
                title={tracked?.notify ? "Notifications enabled" : "Enable notifications"}
              >
                {tracked?.notify ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4 opacity-50" />
                )}
              </button>
            )}

            {/* Movie Watched Button */}
            {isMovie && (
              <button
                onClick={handleToggleMovieWatched}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  tracked?.status === "watched"
                    ? "bg-[#32d74b] text-black border-[#32d74b]"
                    : "bg-[#2c2c2e] text-white border-white/10 hover:border-white/30"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{tracked?.status === "watched" ? "Watched" : "Mark Watched"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Movie Franchise Collection Collapsible Dropdown */}
      {isMovie && details.belongsToCollection && (
        <div className="rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)] shadow-lg transition-all">
          {/* Accordion Trigger Header */}
          <div
            onClick={() => {
              const nextState = !isCollectionExpanded;
              setIsCollectionExpanded(nextState);
              if (nextState && !collectionDetail && details.belongsToCollection) {
                void fetchCollection(details.belongsToCollection.id);
              }
            }}
            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#0a84ff] uppercase tracking-wider">
                  Franchise Collection
                </span>
                {collectionDetail && (
                  <span className="px-2 py-0.5 rounded-full bg-[#0a84ff]/15 text-[#0a84ff] text-[10px] font-bold border border-[#0a84ff]/30">
                    {collectionDetail.parts.filter((p) => p.isWatched).length} / {collectionDetail.parts.length} Watched
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{details.belongsToCollection.name}</span>
              </h3>
              <p className="text-xs text-[#8e8e93]">
                Tap to view all franchise movies and mark all or select titles as watched.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-white/5 text-[#8e8e93] hover:text-white transition-colors shrink-0">
              {isCollectionExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Expanded Dropdown Content */}
          {isCollectionExpanded && (
            <div className="border-t border-[rgba(255,255,255,0.06)] p-4 sm:p-5 space-y-4 bg-black/25">
              {isLoadingCollection ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-5 h-5 text-[#0a84ff] animate-spin mx-auto" />
                  <p className="text-xs text-[#8e8e93]">Loading franchise movies...</p>
                </div>
              ) : collectionDetail ? (
                <div className="space-y-3">
                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleSelectAllParts}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                      >
                        {selectedPartIds.size === collectionDetail.parts.length ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-[#0a84ff]" />
                            <span>Deselect All</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-[#8e8e93]" />
                            <span>Select All</span>
                          </>
                        )}
                      </button>
                      <span className="text-xs text-[#8e8e93]">
                        {selectedPartIds.size} of {collectionDetail.parts.length} selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkSelectedCollectionWatched}
                        disabled={isUpdatingCollectionParts || selectedPartIds.size === 0}
                        className="px-3 py-1.5 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-all ios-press"
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
                        className="px-3 py-1.5 rounded-xl bg-[#32d74b]/15 hover:bg-[#32d74b]/25 border border-[#32d74b]/30 text-[#32d74b] text-xs font-bold flex items-center gap-1.5 transition-all ios-press disabled:opacity-40"
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
                              ? "bg-[#0a84ff]/[0.08] border-[#0a84ff]/40"
                              : "bg-[#161618] border-white/[0.04] hover:border-white/10"
                          } ${isCurrent ? "ring-1 ring-[#ffd60a]/40" : ""}`}
                        >
                          {/* Checkbox */}
                          <div className="p-1 text-white shrink-0">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#0a84ff]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#636366]" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          <div className="relative w-9 h-13 rounded-lg overflow-hidden bg-[#222] shrink-0 border border-white/10">
                            {part.posterPath ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${part.posterPath}`}
                                alt={part.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#8e8e93]">
                                <Film className="w-3.5 h-3.5 opacity-40" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4
                                className="text-xs font-bold text-white truncate"
                                title={part.title}
                              >
                                {part.title}
                              </h4>
                              {isCurrent && (
                                <span className="px-1 py-0.2 rounded bg-[#ffd60a]/20 text-[#ffd60a] text-[9px] font-bold">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#8e8e93] mt-0.5">
                              {part.yearRange || "TBA"}
                            </p>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {part.isWatched ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#32d74b]/15 border border-[#32d74b]/30 text-[#32d74b] text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Watched</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[#8e8e93] text-[10px] font-medium">
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
                <p className="text-xs text-[#ff453a]">Unable to load franchise collection.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Series Seasons & Episodes Explorer */}
      {!isMovie && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight">Seasons & Episodes</h2>
            <span className="text-xs text-[#8e8e93]">
              Check off episodes to update your watching progress
            </span>
          </div>

          {/* Season Accordions */}
          <div className="space-y-3">
            {regularSeasons.map((season) => {
              const seasonNum = season.seasonNumber;
              const isExpanded = expandedSeason === seasonNum;
              const seasonDetail = seasonsCache[seasonNum];
              const isLoadingCurrent = loadingSeason === seasonNum;

              return (
                <div
                  key={seasonNum}
                  className="rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)]"
                >
                  {/* Season Header Accordion Trigger */}
                  <div
                    onClick={() => setExpandedSeason(isExpanded ? null : seasonNum)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#2c2c2e] flex items-center justify-center text-xs font-bold text-white">
                        {seasonNum}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          {season.name || `Season ${seasonNum}`}
                        </h3>
                        <p className="text-[11px] text-[#8e8e93]">
                          {season.episodeCount} Episodes {season.airDate ? `• ${season.airDate.slice(0, 4)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#8e8e93]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#8e8e93]" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Season Episodes View */}
                  {isExpanded && (
                    <div className="border-t border-[rgba(255,255,255,0.06)] p-4 space-y-4 bg-black/20">
                      {/* Season Action Row */}
                      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                        <span className="text-xs text-[#8e8e93] font-medium">
                          {seasonDetail ? `${seasonDetail.airedEpisodesCount} of ${seasonDetail.totalEpisodes} aired` : "Loading..."}
                        </span>

                        {seasonDetail && seasonDetail.airedEpisodesCount > 0 && (
                          <button
                            onClick={() =>
                              handleMarkSeasonWatched(seasonNum, seasonDetail.airedEpisodesCount)
                            }
                            className="px-3 py-1 rounded-lg bg-[#32d74b]/15 hover:bg-[#32d74b]/25 border border-[#32d74b]/30 text-[#32d74b] text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Check className="w-3 h-3" />
                            <span>Mark Season Watched</span>
                          </button>
                        )}
                      </div>

                      {/* Episodes List */}
                      {isLoadingCurrent ? (
                        <div className="py-8 text-center">
                          <Loader2 className="w-5 h-5 text-[#0a84ff] animate-spin mx-auto" />
                          <p className="text-xs text-[#8e8e93] mt-2">Fetching season episodes...</p>
                        </div>
                      ) : seasonDetail ? (
                        <div className="space-y-2.5">
                          {seasonDetail.episodes.map((ep) => {
                            const isWatched = checkIsWatched(seasonNum, ep.episodeNumber);
                            const isAired = ep.isAired;

                            return (
                              <div
                                key={ep.episodeNumber}
                                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                                  isWatched
                                    ? "bg-[#32d74b]/[0.04] border-[#32d74b]/20"
                                    : "bg-[#141416]/50 border-white/[0.04]"
                                }`}
                              >
                                {/* Checkbox */}
                                <button
                                  onClick={() => handleToggleEpisode(seasonNum, ep.episodeNumber)}
                                  disabled={!isAired}
                                  className={`mt-1 w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                                    isWatched
                                      ? "bg-[#32d74b] border-[#32d74b] text-black font-bold"
                                      : isAired
                                      ? "border-white/20 hover:border-white/50 text-transparent"
                                      : "border-white/10 opacity-40 cursor-not-allowed"
                                  }`}
                                  title={!isAired ? "Cannot mark unaired episode" : "Toggle watched"}
                                >
                                  {isWatched && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>

                                {/* Episode Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-white">
                                      {ep.episodeNumber}. {ep.name}
                                    </span>

                                    {ep.airDate && (
                                      <span className="text-[11px] text-[#8e8e93]">
                                        ({ep.airDate})
                                      </span>
                                    )}

                                    {!isAired && (
                                      <span className="px-1.5 py-0.2 rounded bg-[#ff9f0a]/15 text-[#ff9f0a] text-[10px] font-semibold border border-[#ff9f0a]/30">
                                        Unaired
                                      </span>
                                    )}

                                    {ep.runtime && (
                                      <span className="text-[10px] text-[#8e8e93]">
                                        {ep.runtime}m
                                      </span>
                                    )}
                                  </div>

                                  {ep.overview && (
                                    <p className="text-[11px] text-[#8e8e93] line-clamp-2 mt-1">
                                      {ep.overview}
                                    </p>
                                  )}
                                </div>

                                {/* "Mark up to here" Button */}
                                {isAired && !isWatched && (
                                  <button
                                    onClick={() =>
                                      handleMarkAllUpToHere(seasonNum, ep.episodeNumber)
                                    }
                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[#8e8e93] hover:text-white transition-colors shrink-0"
                                    title="Mark all episodes up to this one as watched"
                                  >
                                    Mark up to here
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#8e8e93]">Failed to load episodes.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Season 0 Specials Section (Collapsed by Default, Excluded from Totals) */}
            {specialsSeason && (
              <div className="rounded-2xl overflow-hidden bg-[#1c1c1e]/60 border border-[rgba(255,255,255,0.04)]">
                <div
                  onClick={() => {
                    setIsSpecialsExpanded(!isSpecialsExpanded);
                    if (!isSpecialsExpanded) fetchSeasonEpisodes(0);
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#2c2c2e]/60 flex items-center justify-center text-xs font-bold text-[#8e8e93]">
                      0
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#8e8e93]">
                        Season 0 (Specials)
                      </h3>
                      <p className="text-[10px] text-[#8e8e93]/70">
                        {specialsSeason.episodeCount} Specials • Does not affect series progress
                      </p>
                    </div>
                  </div>

                  {isSpecialsExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#8e8e93]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8e8e93]" />
                  )}
                </div>

                {isSpecialsExpanded && seasonsCache[0] && (
                  <div className="border-t border-[rgba(255,255,255,0.04)] p-4 space-y-2 bg-black/20">
                    {seasonsCache[0].episodes.map((ep) => {
                      const isWatched = checkIsWatched(0, ep.episodeNumber);
                      return (
                        <div
                          key={ep.episodeNumber}
                          className="p-2.5 rounded-xl bg-[#141416]/50 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleEpisode(0, ep.episodeNumber)}
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isWatched
                                  ? "bg-[#32d74b] border-[#32d74b] text-black font-bold"
                                  : "border-white/20 text-transparent"
                              }`}
                            >
                              {isWatched && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <span className="text-white font-medium">
                              S00E{ep.episodeNumber} • {ep.name}
                            </span>
                          </div>
                          {ep.airDate && (
                            <span className="text-[10px] text-[#8e8e93]">{ep.airDate}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 0-10 Rating Modal */}
      {isRatingModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.12)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#ffd60a] fill-[#ffd60a]" />
                <h3 className="text-base font-extrabold text-white">Rate Title</h3>
              </div>
              <button
                onClick={() => setIsRatingModalOpen(false)}
                className="p-1 rounded-full text-[#8e8e93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#8e8e93]">
              Enter a score from <strong className="text-white">0.00 to 10.00</strong> (decimals supported up to 2 places).
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#2c2c2e] border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-[#ffd60a] transition-colors"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8e8e93]">
                  / 10
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <p className="text-[11px] font-semibold text-[#8e8e93] mb-1.5">Quick Presets</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[5.0, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRatingInput(String(preset))}
                    className="py-1 rounded-lg bg-white/5 hover:bg-white/15 text-xs font-semibold text-white border border-white/5 transition-colors"
                  >
                    {preset.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/[0.06]">
              {tracked?.rating !== undefined && tracked?.rating !== null ? (
                <button
                  type="button"
                  onClick={() => handleSaveRating(null)}
                  disabled={isSavingRating}
                  className="px-3 py-2 rounded-xl bg-[#ff453a]/15 hover:bg-[#ff453a]/25 text-[#ff453a] text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(false)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#8e8e93] hover:text-white"
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
                  className="px-4 py-2 rounded-xl bg-[#ffd60a] hover:bg-[#eac408] text-black text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
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

