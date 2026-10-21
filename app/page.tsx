"use client";

import Link from "next/link";
import {
  Search,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { ContinueWatchingRow } from "@/components/home/continue-watching-row";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
      {/* iOS Large Title Header */}
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          {user?.username ? `Welcome, ${user.username}` : "TrackIt"}
        </h1>
        <p className="text-sm md:text-base text-[#8e8e93]">
          Track your movies and TV shows effortlessly.
        </p>
      </div>

      {/* Dynamic Continue Watching Row */}
      <ContinueWatchingRow />

      {/* Quick Navigation Cards */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white tracking-tight">Explore</h2>
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

    </div>
  );
}
