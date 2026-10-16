"use client";

/**
 * Top Header Navigation Bar
 *
 * Implements Apple iOS translucent navigation bar:
 * - Dynamic context title.
 * - Bell icon with real-time unread notification badge counter.
 * - Accessible touch targets and focus indicators.
 */

import Link from "next/link";
import { Bell, Film } from "lucide-react";
import { usePathname } from "next/navigation";

interface TopHeaderProps {
  unreadCount?: number;
}

export function TopHeader({ unreadCount = 0 }: TopHeaderProps) {
  const pathname = usePathname();

  // Determine dynamic title for mobile view based on current path
  const getPageTitle = () => {
    if (pathname === "/") return "WatchTrack";
    if (pathname.startsWith("/search")) return "Search";
    if (pathname.startsWith("/lists")) return "My Lists";
    if (pathname.startsWith("/recommendations")) return "Picks for You";
    if (pathname.startsWith("/profile")) return "Settings";
    if (pathname.startsWith("/notifications")) return "Notifications";
    return "WatchTrack";
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-bar border-b border-[rgba(255,255,255,0.08)] pt-safe">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Mobile Brand / Page Title */}
        <div className="flex items-center gap-2.5">
          <div className="md:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-[#0a84ff] to-[#005bb5] flex items-center justify-center shadow-md shadow-[#0a84ff]/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white md:hidden">
            {getPageTitle()}
          </h2>
          <span className="hidden md:inline-block text-xs font-medium text-[#8e8e93]">
            {getPageTitle()}
          </span>
        </div>

        {/* Right Actions: Notifications Bell */}
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            className="relative flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-full text-[#8e8e93] hover:text-white hover:bg-[rgba(255,255,255,0.08)] active:bg-[rgba(255,255,255,0.12)] transition-colors ios-press"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                role="status"
                aria-label={`${unreadCount} unread notifications`}
                className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff453a] text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-[#ff453a]/50 animate-pulse"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

