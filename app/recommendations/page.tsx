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
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

interface RecommendationItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  reason: string;
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
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <span>Picks for You</span>
            <Sparkles className="w-6 h-6 text-[#bf5af2]" />
          </h1>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Personalized suggestions generated with Gemini AI and strictly validated with TMDB.
          </p>
        </div>

        {hasGeminiKey && recommendations.length > 0 && (
          <button
            onClick={() => handleGenerateRecommendations(true)}
            disabled={isLoading}
            className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#2c2c2e] hover:bg-[#3a3a3c] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#bf5af2]" : ""}`} />
            <span>Refresh Picks</span>
          </button>
        )}
      </div>

      {/* Key Requirement Banners */}
      {!hasGeminiKey && (
        <div className="p-4 rounded-2xl bg-[#2b1736] border border-[#bf5af2]/40 backdrop-blur-xl flex items-start gap-3.5">
          <Key className="w-5 h-5 text-[#bf5af2] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-semibold text-white">Google Gemini API Key Required</h3>
            <p className="text-[#f5d9ff]/90 leading-relaxed">
              To generate AI recommendations, obtain a 100% free API key from Google AI Studio and paste it in Settings.
            </p>
            <div className="pt-1 flex items-center gap-4">
              <Link
                href="/profile"
                className="text-[#bf5af2] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Add Gemini Key in Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8e8e93] hover:text-white"
              >
                Get free key &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#2a0e0e] border border-[#ff453a]/40 text-xs text-[#ff9f98] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#ff453a] shrink-0 mt-0.5" />
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
              className="p-4 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] animate-pulse h-40"
            />
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-4">
          {generatedAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93]">
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
                  className="rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.2)] transition-all flex flex-col justify-between p-3.5 space-y-3"
                >
                  <div className="flex gap-3">
                    {/* Poster */}
                    <Link
                      href={`/title/${item.mediaType}/${item.tmdbId}`}
                      className="relative w-16 h-24 rounded-xl overflow-hidden bg-[#141416] shrink-0 border border-white/10"
                    >
                      {item.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#8e8e93]">
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
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.2 rounded bg-black/60 text-[9px] font-bold text-white uppercase border border-white/10">
                          {item.mediaType === "movie" ? "Movie" : "Series"}
                        </span>
                        <span className="text-[10px] text-[#8e8e93]">
                          {item.yearRange || "TBA"}
                        </span>
                      </div>

                      <Link
                        href={`/title/${item.mediaType}/${item.tmdbId}`}
                        className="text-xs font-bold text-white hover:text-[#0a84ff] line-clamp-1 block"
                        title={item.title}
                      >
                        {item.title}
                      </Link>

                      <p className="text-[11px] text-[#8e8e93] leading-relaxed line-clamp-3">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom Strip */}
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 text-[10px] text-[#32d74b] font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>TMDB Verified</span>
                    </div>

                    {isAdded ? (
                      <span className="px-2.5 py-1 rounded-lg bg-[#32d74b]/15 text-[#32d74b] text-[10px] font-bold flex items-center gap-1 border border-[#32d74b]/30">
                        <Check className="w-3 h-3" />
                        <span>In Watchlist</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleQuickAdd(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#0a84ff]/20 hover:bg-[#0a84ff]/30 text-[#0a84ff] text-[10px] font-bold flex items-center gap-1 border border-[#0a84ff]/40 transition-all"
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
          <div className="w-14 h-14 rounded-2xl bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30 flex items-center justify-center mx-auto shadow-lg shadow-[#bf5af2]/10">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Unlock Tailored Recommendations</h2>
            <p className="text-xs text-[#8e8e93] max-w-md mx-auto leading-relaxed">
              Track or rate at least 3 titles in your library, connect your free Gemini API key, and tap below to generate private picks.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => handleGenerateRecommendations(false)}
              disabled={isLoading || !hasGeminiKey || !hasTmdbKey}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#bf5af2] hover:bg-[#a643d9] text-white text-xs font-bold transition-all shadow-md shadow-[#bf5af2]/20 disabled:opacity-40 disabled:cursor-not-allowed"
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
