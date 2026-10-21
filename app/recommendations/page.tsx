"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  Key,
  ShieldCheck,
  Film,
  Tv,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowRight,
  Star,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

interface RecommendationItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  reason: string;
  predictedRating?: number;
  posterPath: string | null;
  yearRange: string;
}

export default function RecommendationsPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  // Fetch cached recommendations on mount
  const fetchCachedRecommendations = useCallback(async () => {
    if (!user) {
      setIsInitialLoading(false);
      return;
    }

    try {
      setIsInitialLoading(true);
      const res = await fetch("/api/recommendations");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setRecommendations(json.data.recommendations || []);
          setGeneratedAt(json.data.generatedAt || null);
        }
      }
    } catch {
      // Ignore initial load error
    } finally {
      setIsInitialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        void fetchCachedRecommendations();
      }
    });
    return () => {
      mounted = false;
    };
  }, [fetchCachedRecommendations]);

  // Trigger Gemini AI generation
  const handleGenerateRecommendations = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate recommendations");
      }

      setRecommendations(json.data.recommendations || []);
      setGeneratedAt(json.data.generatedAt || new Date().toISOString());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // One-tap Add to Watchlist
  const handleQuickAdd = async (item: RecommendationItem) => {
    const key = `${item.mediaType}-${item.tmdbId}`;
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          posterPath: item.posterPath,
          yearRange: item.yearRange,
          notify: item.mediaType === "tv",
        }),
      });

      if (res.ok) {
        setAddedMap((prev) => ({ ...prev, [key]: true }));
      }
    } catch {
      alert("Failed to track title");
    }
  };

  const hasGeminiKey = user?.hasGeminiKey ?? false;
  const hasTmdbKey = user?.hasTmdbKey ?? false;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-5xl md:text-[64px] leading-[0.9] flex items-center gap-3">
            <span>Picks for You</span>
            <Sparkles className="w-6 h-6 text-[#b48cc0]" />
          </h1>
          <p className="text-sm text-[#b7a9bc] mt-0.5">
            Personalized suggestions generated with Gemini AI and strictly validated with TMDB.
          </p>
        </div>

        {hasGeminiKey && recommendations.length > 0 && (
          <button
            onClick={() => handleGenerateRecommendations(true)}
            disabled={isLoading}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#2c1b33] hover:bg-[#3a2541] border border-plum-line text-cream text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#b48cc0]" : ""}`} />
            <span>Refresh Picks</span>
          </button>
        )}
      </div>

      {/* Key Requirement Banners */}
      {!hasGeminiKey && (
        <div className="p-4 rounded-2xl bg-[#1f1424] border border-[#b48cc0]/40 backdrop-blur-xl flex items-start gap-3.5">
          <Key className="w-5 h-5 text-[#b48cc0] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-semibold text-cream">Google Gemini API Key Required</h3>
            <p className="text-[#e2cce8]/90 leading-relaxed">
              To generate AI recommendations, obtain a 100% free API key from Google AI Studio and paste it in Settings.
            </p>
            <div className="pt-1 flex items-center gap-4">
              <Link
                href="/profile"
                className="text-[#b48cc0] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Add Gemini Key in Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#b7a9bc] hover:text-cream"
              >
                Get free key &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#1f1424] border border-[#ff8a80]/40 text-xs text-[#ff8a80] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#ff8a80] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Recommendation Notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Recommendations Content */}
      {isInitialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-[#1f1424] border border-plum-line animate-pulse h-40"
            />
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-4">
          {generatedAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#b7a9bc]">
              <Clock className="w-3.5 h-3.5" />
              <span>Last generated: {new Date(generatedAt).toLocaleString()}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((item) => {
              const key = `${item.mediaType}-${item.tmdbId}`;
              const isAdded = addedMap[key];

              return (
                <div
                  key={key}
                  className="rounded-2xl overflow-hidden bg-[#1f1424] border border-plum-line hover:border-plum-line transition-all flex flex-col justify-between p-3.5 space-y-3"
                >
                  <div className="flex gap-3">
                    {/* Poster */}
                    <Link
                      href={`/title/${item.mediaType}/${item.tmdbId}`}
                      className="relative w-16 h-24 rounded-xl overflow-hidden bg-[#160e19] shrink-0 border border-plum-line"
                    >
                      {item.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#b7a9bc]">
                          {item.mediaType === "movie" ? (
                            <Film className="w-5 h-5 opacity-40" />
                          ) : (
                            <Tv className="w-5 h-5 opacity-40" />
                          )}
                        </div>
                      )}
                    </Link>

                    {/* Metadata & Reason */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="px-1.5 py-0.2 rounded bg-ink/ text-[9px] font-bold text-cream uppercase border border-plum-line">
                          {item.mediaType === "movie" ? "Movie" : "Series"}
                        </span>
                        <span className="text-[10px] text-[#b7a9bc]">
                          {item.yearRange || "TBA"}
                        </span>
                        {item.predictedRating !== undefined && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#4fd27f]/15 border border-[#4fd27f]/30 text-[9px] font-bold text-[#4fd27f]">
                            <Star className="w-2.5 h-2.5 fill-[#4fd27f]" />
                            <span>{item.predictedRating}/10 Match</span>
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/title/${item.mediaType}/${item.tmdbId}`}
                        className="text-xs font-bold text-cream hover:text-[#4fd27f] line-clamp-1 block"
                        title={item.title}
                      >
                        {item.title}
                      </Link>

                      <p className="text-[11px] text-[#b7a9bc] leading-relaxed line-clamp-3">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Strip */}
                  <div className="pt-2 border-t border-plum-line flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 text-[10px] text-[#4fd27f] font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>TMDB Verified</span>
                    </div>

                    {isAdded ? (
                      <span className="px-2.5 py-1 rounded-lg bg-[#4fd27f]/15 text-[#4fd27f] text-[10px] font-bold flex items-center gap-1 border border-[#4fd27f]/30">
                        <Check className="w-3 h-3" />
                        <span>In Watchlist</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleQuickAdd(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#4fd27f]/20 hover:bg-[#4fd27f]/30 text-[#4fd27f] text-[10px] font-bold flex items-center gap-1 border border-[#4fd27f]/40 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Want to Watch</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="ios-card p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#b48cc0]/15 text-[#b48cc0] border border-[#b48cc0]/30 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-cream">Unlock Tailored Recommendations</h2>
            <p className="text-xs text-[#b7a9bc] max-w-md mx-auto leading-relaxed">
              Track or rate at least 3 titles in your library, connect your free Gemini API key, and tap below to generate private picks.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handleGenerateRecommendations(false)}
              disabled={isLoading || !hasGeminiKey || !hasTmdbKey}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-eggplant hover:bg-plum-line text-cream text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isLoading ? "Analyzing tastes..." : "Get AI Recommendations"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
