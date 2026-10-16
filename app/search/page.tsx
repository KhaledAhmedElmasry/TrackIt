/**
 * Search Page Shell (Phase 1 preview, ready for Phase 3 integration)
 */

import { Search as SearchIcon, Filter } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Search
        </h1>
        <p className="text-sm text-[#8e8e93] mt-0.5">
          Find movies and TV series across TMDB database.
        </p>
      </div>

      {/* iOS styled Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8e8e93]">
          <SearchIcon className="w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder="Search by title, or 'Batman 2022'..."
          disabled
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#8e8e93] text-sm focus:outline-none focus:border-[#0a84ff] transition-all disabled:opacity-75"
        />
      </div>

      {/* Filter Tabs Preview */}
      <div className="flex items-center gap-2">
        {["All", "Movies", "TV Series"].map((filter, idx) => (
          <button
            key={filter}
            disabled
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              idx === 0
                ? "bg-[#0a84ff] text-white"
                : "bg-[#1c1c1e] text-[#8e8e93] border border-[rgba(255,255,255,0.06)]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Skeleton / Initial State */}
      <div className="ios-card p-8 text-center space-y-2">
        <Filter className="w-8 h-8 text-[#8e8e93] mx-auto opacity-40" />
        <p className="text-sm font-semibold text-white">Search integration ready</p>
        <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
          Debounced TMDB multi-search with year extraction, recent cache, and one-tap watchlist tracking will activate in Phase 3.
        </p>
      </div>
    </div>
  );
}

