"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { Logo } from "@/components/brand/logo";
import type { HomeSummary } from "@/lib/services/tracking.service";
import { useCachedFetch } from "@/lib/client/cache";

const pad = (n: number) => String(n).padStart(2, "0");
const episodeCode = (s: number, e: number) => `S${pad(s)} E${pad(e)}`;

function formatToday() {
  return new Date()
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .replace(",", "")
    .toUpperCase();
}

function airDateParts(airDate: string) {
  const d = new Date(`${airDate}T00:00:00`);
  const days = Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  const when =
    days <= 0 ? "Today" : days === 1 ? "Tomorrow" : days < 7 ? d.toLocaleDateString("en-GB", { weekday: "long" }) : `In ${days} days`;
  return {
    mon: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    day: pad(d.getDate()),
    when,
  };
}

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: summary, refresh } = useCachedFetch<HomeSummary>(user ? "/api/tracking/home" : null, user?.id);
  const [markingId, setMarkingId] = useState<string | null>(null);


  const markWatched = async (item: HomeSummary["nowShowing"][number]) => {
    setMarkingId(item.id);
    try {
      await fetch("/api/tracking/episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.tmdbId,
          seasonNumber: item.season,
          episodeNumber: item.episode,
          totalAiredEpisodes: 0,
        }),
      });
      await refresh();
    } finally {
      setMarkingId(null);
    }
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col justify-center gap-8 max-w-2xl">
        <Logo size="lg" className="md:hidden" />
        <h1 className="font-display font-black text-6xl md:text-8xl leading-[0.88]">
          Every film.
          <br />
          Every episode.
          <br />
          <span className="text-green">Tracked.</span>
        </h1>
        <p className="text-lg text-smoke max-w-lg">
          Keep your watchlist, tick off episodes as you go and get a ping when a new one airs.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="h-12 px-6 rounded-[10px] bg-green text-ink font-bold flex items-center ios-press">
            Create free account
          </Link>
          <Link href="/login" className="h-12 px-6 rounded-[10px] border border-plum-line font-semibold flex items-center ios-press">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const nowShowing = summary?.nowShowing ?? [];
  const upcoming = summary?.upcoming ?? [];
  const counts = summary?.counts;

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs md:text-[13px] tracking-[0.12em] text-lilac">
            {formatToday()}
            {nowShowing.length > 0 && ` · ${nowShowing.length} IN PROGRESS`}
          </span>
          <h1 className="font-display font-black text-5xl md:text-[76px] leading-[0.9]">Tonight&rsquo;s program</h1>
        </div>
        <Link
          href="/search"
          className="hidden md:flex h-11 px-5 rounded-[10px] border border-plum-line items-center gap-2 text-sm font-semibold hover:border-green transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          Add a title
        </Link>
      </header>

      <section aria-labelledby="now-showing" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="now-showing" className="font-display font-extrabold text-[28px] md:text-[34px]">
            Now showing
          </h2>
          {nowShowing.length > 0 && (
            <Link href="/lists?tab=currently_watching" className="text-sm font-semibold text-smoke hover:text-cream">
              All in progress
            </Link>
          )}
        </div>

        {!summary ? (
          <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[196px] rounded-[14px] bg-plum animate-pulse" />
            ))}
          </div>
        ) : nowShowing.length === 0 ? (
          <div className="rounded-[14px] bg-plum p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-smoke">Nothing in progress. Find a series and tick off the first episode.</p>
            <Link href="/search" className="h-11 px-5 rounded-[10px] bg-green text-ink font-bold flex items-center ios-press">
              Find something to watch
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {nowShowing.map((item) => {
              const pct = item.totalEpisodes ? Math.min(100, Math.round((item.watchedCount / item.totalEpisodes) * 100)) : null;
              return (
                <article key={item.id} className="card-hover flex rounded-[14px] bg-plum overflow-hidden min-h-[196px]">
                  <Link href={`/title/tv/${item.tmdbId}`} className="relative w-[120px] shrink-0 bg-eggplant">
                    {item.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                        alt={item.title}
                        fill
                        sizes="120px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 p-3 flex items-end font-display font-black text-2xl leading-[0.9]">
                        {item.title}
                      </span>
                    )}
                  </Link>
                  <div className="ticket-perf w-3 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0 py-4 pr-4 pl-1.5 flex flex-col gap-2">
                    <span className="font-mono text-xs tracking-[0.08em] text-lilac">
                      NEXT · {episodeCode(item.season, item.episode)}
                    </span>
                    <Link href={`/title/tv/${item.tmdbId}`} className="text-lg font-bold leading-tight hover:text-green">
                      {item.title}
                    </Link>
                    {item.episodeName && <span className="text-[13px] text-smoke truncate">&ldquo;{item.episodeName}&rdquo;</span>}
                    {pct !== null && (
                      <div className="mt-auto flex flex-col gap-1.5">
                        <div className="h-1 rounded-full bg-plum-line overflow-hidden">
                          <div className="h-1 bg-green" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-[11px] text-dim">
                          {item.watchedCount} OF {item.totalEpisodes} EPISODES
                        </span>
                      </div>
                    )}
                    {item.episodeAired ? (
                      <button
                        type="button"
                        onClick={() => markWatched(item)}
                        disabled={markingId === item.id}
                        className={`${pct === null ? "mt-auto" : ""} h-10 rounded-[9px] bg-green text-ink text-sm font-bold flex items-center justify-center gap-2 ios-press disabled:opacity-70`}
                      >
                        {markingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.6} />}
                        Mark watched
                      </button>
                    ) : (
                      <span className={`${pct === null ? "mt-auto" : ""} h-10 rounded-[9px] border border-dashed border-plum-line text-smoke text-sm font-semibold flex items-center justify-center`}>
                        Not aired yet
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-10 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
        <section aria-labelledby="coming-soon" className="flex flex-col gap-3.5">
          <h2 id="coming-soon" className="font-display font-extrabold text-[28px] md:text-[34px]">
            Coming soon
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-smoke">
              No upcoming episodes yet. Open a series you follow and its next air date shows up here.
            </p>
          ) : (
            <ol className="flex flex-col">
              {upcoming.map((u) => {
                const { mon, day, when } = airDateParts(u.airDate);
                return (
                  <li key={`${u.tmdbId}-${u.season}-${u.episode}`}>
                    <Link
                      href={`/title/tv/${u.tmdbId}`}
                      className="flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg border-b border-[#241829] hover:bg-plum hover:text-green transition-colors"
                    >
                      <span className="w-14 shrink-0 flex flex-col items-center border border-plum-line rounded-lg py-1.5">
                        <span className="font-mono text-[10px] tracking-[0.1em] text-lilac">{mon}</span>
                        <span className="font-display font-extrabold text-[26px] leading-none">{day}</span>
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="font-semibold truncate">{u.title}</span>
                        <span className="font-mono text-xs text-smoke">{episodeCode(u.season, u.episode)}</span>
                      </span>
                      <span className="text-xs text-dim">{when}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section aria-labelledby="your-reels" className="flex flex-col gap-3.5">
          <h2 id="your-reels" className="font-display font-extrabold text-[28px] md:text-[34px]">
            Your reels
          </h2>
          <div className="flex flex-col gap-2.5">
            {[
              { name: "Watching", tab: "currently_watching", count: counts?.currently_watching },
              { name: "Want to watch", tab: "want_to_watch", count: counts?.want_to_watch },
              { name: "Watched", tab: "watched", count: counts?.watched },
            ].map((reel) => (
              <Link
                key={reel.tab}
                href={`/lists?tab=${reel.tab}`}
                className="card-hover flex items-center gap-4 px-4 py-3.5 rounded-xl bg-plum"
              >
                <span className="flex-1 font-semibold">{reel.name}</span>
                <span className="font-display font-extrabold text-3xl text-green">{reel.count ?? "–"}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
