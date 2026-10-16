"use client";

/**
 * Desktop Left Sidebar Navigation Component
 *
 * Provides persistent navigation on PC/desktop screens (md and above).
 * Incorporates Apple macOS/iOS sidebar styling with subtle translucency,
 * active link pills, and mandatory TMDB attribution in the footer.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "./bottom-nav";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Desktop Navigation Sidebar"
      className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-30 glass-bar border-r border-[rgba(255,255,255,0.08)] p-4 select-none"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-3 py-4 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#005bb5] flex items-center justify-center shadow-lg shadow-[#0a84ff]/20">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            WatchTrack
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.08)] text-[#8e8e93]">
              Private
            </span>
          </h1>
          <p className="text-[11px] text-[#8e8e93]">Your personal tracker</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ios-press",
                isActive
                  ? "bg-[#0A84FF] text-white shadow-md shadow-[#0A84FF]/25 font-semibold"
                  : "text-[#8E8E93] hover:text-[#f5f5f7] hover:bg-[rgba(255,255,255,0.05)]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform",
                  isActive ? "stroke-[2.25]" : "stroke-[1.75]"
                )}
              />
              <span>{item.name === "Picks" ? "Recommendations" : item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Security & Free-tier Status Badge */}
      <div className="my-4 px-3 py-3 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-[#32d74b]" />
          <span className="text-xs font-semibold text-white">Private & Encrypted</span>
        </div>
        <p className="text-[11px] text-[#8e8e93] leading-relaxed">
          User keys encrypted with AES-256-GCM. Scoped strictly to your session.
        </p>
      </div>

      {/* Mandatory TMDB Attribution & Logo Text */}
      <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] px-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black tracking-widest px-1.5 py-0.5 rounded bg-[#01b4e4] text-[#0d253f]">
            TMDB
          </span>
          <span className="text-[11px] font-semibold text-[#8e8e93]">Attribution</span>
        </div>
        <p className="text-[10px] text-[#636366] leading-tight">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </aside>
  );
}

