/**
 * WatchTrack Home Dashboard
 *
 * Implements Apple iOS style:
 * - Large title styling with crisp contrast.
 * - Translucent rounded cards and quick navigation buttons.
 * - "Continue Watching" row preview.
 * - Free-tier stack status indicators and PWA install guide.
 */

import Link from "next/link";
import {
  Film,
  Search,
  Sparkles,
  Layers,
  Key,
  ShieldCheck,
  Smartphone,
  Server,
  ArrowRight,
  PlayCircle,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* iOS Large Title Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0a84ff]/15 border border-[#0a84ff]/30 text-[#0a84ff] text-xs font-semibold">
          <span>Phase 1 Verified</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#32d74b]" />
          <span>App Shell Active</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          WatchTrack
        </h1>
        <p className="text-sm md:text-base text-[#8e8e93]">
          Your private, encrypted movie and TV series tracker.
        </p>
      </div>

      {/* Continue Watching Section (Phase 1 preview) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-[#0a84ff]" />
            <h2 className="text-lg font-bold text-white tracking-tight">Continue Watching</h2>
          </div>
          <span className="text-xs text-[#8e8e93]">Next unwatched episodes</span>
        </div>

        {/* Empty state placeholder styled like iOS card */}
        <div className="ios-card p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#8e8e93]">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">No active series yet</p>
            <p className="text-xs text-[#8e8e93] max-w-sm mt-0.5">
              Once you add series to your watchlist, your next unwatched episode will appear here for instant one-tap tracking.
            </p>
          </div>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a84ff] text-white text-xs font-semibold ios-press hover:bg-[#0071e3] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search titles to track</span>
          </Link>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white tracking-tight">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <Link
            href="/search"
            className="ios-card p-4.5 flex items-start gap-3.5 ios-press group"
          >
            <div className="p-3 rounded-2xl bg-[#0a84ff]/15 text-[#0a84ff] group-hover:scale-105 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Search TMDB</h3>
                <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-[#8e8e93] mt-0.5 leading-relaxed">
                Multi-search movies and TV shows, filter by year, one-tap add.
              </p>
            </div>
          </Link>

          <Link
            href="/lists"
            className="ios-card p-4.5 flex items-start gap-3.5 ios-press group"
          >
            <div className="p-3 rounded-2xl bg-[#32d74b]/15 text-[#32d74b] group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Tracked Lists</h3>
                <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-[#8e8e93] mt-0.5 leading-relaxed">
                Want to Watch, Currently Watching, Watched (auto-derived).
              </p>
            </div>
          </Link>

          <Link
            href="/recommendations"
            className="ios-card p-4.5 flex items-start gap-3.5 ios-press group"
          >
            <div className="p-3 rounded-2xl bg-[#bf5af2]/15 text-[#bf5af2] group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">AI Recommendations</h3>
                <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-[#8e8e93] mt-0.5 leading-relaxed">
                Private recommendations powered by Gemini with strict TMDB verification.
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Free Tier Infrastructure & Privacy Spec */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white tracking-tight">Zero-Cost Architecture</h2>
        <div className="ios-card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                <Server className="w-4 h-4 text-[#0a84ff]" />
                <span>MongoDB Atlas M0</span>
              </div>
              <p className="text-[11px] text-[#8e8e93]">
                512 MB free tier, singleton pool, compact season ranges.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                <ShieldCheck className="w-4 h-4 text-[#32d74b]" />
                <span>AES-256-GCM</span>
              </div>
              <p className="text-[11px] text-[#8e8e93]">
                User TMDB and Gemini keys encrypted with random IV at rest.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
                <Smartphone className="w-4 h-4 text-[#ffd60a]" />
                <span>PWA Standalone</span>
              </div>
              <p className="text-[11px] text-[#8e8e93]">
                Installable from Safari/Chrome. Instant launch & read-only offline.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#8e8e93]" />
              <span className="text-xs text-[#8e8e93]">
                To track titles, add your free TMDB API key in settings.
              </span>
            </div>
            <Link
              href="/profile"
              className="text-xs font-semibold text-[#0a84ff] hover:underline inline-flex items-center gap-1"
            >
              Configure Keys <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
