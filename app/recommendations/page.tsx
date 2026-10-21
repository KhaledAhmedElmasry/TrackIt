"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Key,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useCachedFetch } from "@/lib/client/cache";
import { apiErrorMessage } from "@/lib/client/api-error";

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
  const { data: cachedPicks, isLoading: isInitialLoading, mutate } = useCachedFetch<{
    recommendations: RecommendationItem[];
    generatedAt: string | null;
  }>(user ? "/api/recommendations" : null, user?.id);
  const recommendations = cachedPicks?.recommendations ?? [];
  const generatedAt = cachedPicks?.generatedAt ?? null;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

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
        throw new Error(apiErrorMessage(json, "Failed to generate recommendations"));
      }

      mutate(() => ({
        recommendations: json.data.recommendations || [],
        generatedAt: json.data.generatedAt || new Date().toISOString(),
      }));
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
    <div className="flex flex-col gap-7 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-black text-5xl md:text-[76px] leading-[0.9]">Picks for you</h1>
          {generatedAt && recommendations.length > 0 && (
            <span className="font-mono text-xs tracking-[0.08em] text-smoke">
              PICKED{" "}
              {new Date(generatedAt)
                .toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                .toUpperCase()}
            </span>
          )}
        </div>

        {hasGeminiKey && recommendations.length > 0 && (
          <button
            type="button"
            onClick={() => handleGenerateRecommendations(true)}
            disabled={isLoading}
            className="btn-quiet h-11 px-5 rounded-[10px] border border-plum-line text-sm font-semibold flex items-center gap-2 hover:border-green hover:bg-plum transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-green" : ""}`} />
            New picks
          </button>
        )}
      </div>

      {!hasGeminiKey && (
        <div className="p-4 rounded-[14px] bg-plum border border-lilac/40 flex items-start gap-3.5">
          <Key className="w-5 h-5 text-lilac shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">Gemini key needed</p>
            <p className="text-smoke">Picks need a free Google Gemini API key. Add it in Settings.</p>
            <div className="pt-1 flex flex-wrap items-center gap-4">
              <Link href="/profile" className="text-green font-semibold hover:underline inline-flex items-center gap-1">
                Add Gemini key
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-smoke hover:text-cream"
              >
                Get a free key &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-[14px] bg-plum border border-danger/40 text-sm text-danger flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {isInitialLoading ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[14px] bg-plum animate-pulse h-48" />
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
          {recommendations.map((item) => {
            const key = `${item.mediaType}-${item.tmdbId}`;
            const isAdded = addedMap[key];
            const href = `/title/${item.mediaType}/${item.tmdbId}`;

            return (
              <li
                key={key}
                className="card-hover group flex gap-4 p-4 rounded-[14px] bg-plum border border-transparent hover:border-lilac"
              >
                <Link href={href} className="relative w-[84px] shrink-0 aspect-[2/3] self-start rounded-md overflow-hidden bg-eggplant">
                  {item.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${item.posterPath}`}
                      alt={item.title}
                      fill
                      sizes="84px"
                      className="object-cover group-hover:scale-[1.04] transition-transform duration-300"
                    />
                  ) : (
                    <span className="absolute inset-0 p-2 flex items-end font-display font-black text-lg leading-[0.9]">
                      {item.title}
                    </span>
                  )}
                </Link>

                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-[11px] tracking-[0.1em] text-lilac">
                      {item.mediaType === "movie" ? "FILM" : "SERIES"} · {item.yearRange || "TBA"}
                    </span>
                    {item.predictedRating !== undefined && (
                      <span className="font-mono text-[11px] font-semibold text-green">{item.predictedRating}/10 MATCH</span>
                    )}
                  </div>
                  <Link href={href} className="font-bold text-[15px] leading-tight hover:text-green">
                    {item.title}
                  </Link>
                  <p className="text-[13px] text-smoke leading-relaxed line-clamp-3">{item.reason}</p>

                  <div className="mt-auto pt-2">
                    {isAdded ? (
                      <span className="h-9 px-3 rounded-[9px] bg-plum-line text-[#e2cce8] text-[13px] font-semibold inline-flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-green" strokeWidth={2.8} />
                        On your list
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(item)}
                        className="btn-outline h-9 px-3.5 rounded-[9px] border border-green text-green text-[13px] font-bold inline-flex items-center gap-1.5 hover:bg-green hover:text-ink transition-colors"
                      >
                        <Plus className="w-4 h-4" strokeWidth={2.6} />
                        Want to watch
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-[14px] bg-plum p-10 text-center flex flex-col items-center gap-3">
          <p className="font-display font-extrabold text-3xl">No picks yet</p>
          <p className="text-sm text-smoke max-w-md">
            Track or rate at least 3 titles and add your Gemini key, then get picks based on what you like.
          </p>
          <button
            type="button"
            onClick={() => handleGenerateRecommendations(false)}
            disabled={isLoading || !hasGeminiKey || !hasTmdbKey}
            className="btn-primary mt-2 h-11 px-5 rounded-[10px] bg-green text-ink text-sm font-bold inline-flex items-center gap-2 hover:bg-green-hover transition-colors disabled:opacity-40"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? "Picking…" : "Get my picks"}
          </button>
        </div>
      )}
    </div>
  );
}
