/**
 * Lists Page Shell (Phase 1 preview, ready for Phase 3 integration)
 */

import { Film, CheckCircle2, PlayCircle, Bookmark } from "lucide-react";

export default function ListsPage() {
  const tabs = [
    { id: "want_to_watch", name: "Want to Watch", icon: Bookmark, count: 0 },
    { id: "currently_watching", name: "Currently Watching", icon: PlayCircle, count: 0 },
    { id: "watched", name: "Watched", icon: CheckCircle2, count: 0 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          My Lists
        </h1>
        <p className="text-sm text-[#8e8e93] mt-0.5">
          Auto-derived status based on episode tracking.
        </p>
      </div>

      {/* iOS Segmented Control */}
      <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)]">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              disabled
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                idx === 0
                  ? "bg-[#2c2c2e] text-white shadow-sm"
                  : "text-[#8e8e93] hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="truncate">{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      <div className="ios-card p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#8e8e93]">
          <Film className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-white">Your watchlist is empty</p>
        <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
          Titles in your lists will display with start-to-end release years and instant episode status.
        </p>
      </div>
    </div>
  );
}

