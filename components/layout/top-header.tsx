"use client";

/**
 * Top Header Navigation Bar
 *
 * Implements Apple iOS translucent navigation bar:
 * - Dynamic context title.
 * - Bell icon with real-time unread notification badge counter.
 * - Accessible touch targets and focus indicators.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bell, Film } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

interface TopHeaderProps {
  unreadCount?: number;
}

export function TopHeader({ unreadCount: initialCount = 0 }: TopHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [fetchedCount, setFetchedCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) {
      setFetchedCount(0);
      return;
    }
    try {
      const res = await fetch("/api/notifications?countOnly=1");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setFetchedCount(json.data.unreadCount || 0);
        }
      }
    } catch {
      // Ignore background notification fetch errors
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void fetchUnread();
    });
    return () => {
      mounted = false;
    };
  }, [fetchUnread, pathname]);

  const unreadCount = initialCount > 0 ? initialCount : fetchedCount;

  // Determine dynamic title for mobile view based on current path
  const getPageTitle = () => {
    if (pathname === "/") return "TrackIt";
    if (pathname.startsWith("/search")) return "Search";
    if (pathname.startsWith("/lists")) return "My Lists";
    if (pathname.startsWith("/recommendations")) return "Picks for You";
    if (pathname.startsWith("/profile")) return "Settings";
    if (pathname.startsWith("/notifications")) return "Notifications";
    return "TrackIt";
  };

  return (
    <header className="sticky top-0 z-30 w-full glass-bar border-b border-[rgba(255,255,255,0.08)] pt-safe">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Mobile Brand / Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="md:hidden w-8 h-8 rounded-xl bg-gradient-to-br from-[#0a84ff] to-[#005bb5] flex items-center justify-center shadow-md shadow-[#0a84ff]/20 shrink-0">
            <Film className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-white md:hidden truncate">
            {getPageTitle()}
          </h2>
          <span className="hidden md:inline-block text-xs font-medium text-[#8e8e93]">
            {getPageTitle()}
          </span>
        </div>

        {/* Right Actions: User Profile badge & Notifications Bell with Hover Tooltip */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {user && (
            <Link
              href="/profile"
              className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.08)] transition-all ios-press text-xs font-semibold text-white max-w-[160px]"
              title={user.username ? `@${user.username}` : user.email}
            >
              <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-[#0a84ff] to-[#5856d6] flex items-center justify-center text-[11px] sm:text-[10px] font-bold text-white shrink-0">
                {(user.username || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline truncate">{user.username || user.email.split("@")[0]}</span>
            </Link>
          )}

          <div className="relative group">
            <Link
              href="/notifications"
              title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
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

            {/* Apple styled hover popover/tooltip */}
            <div className="absolute right-0 top-full mt-1 hidden group-hover:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.12)] shadow-xl text-xs whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
              <span className={`w-2 h-2 rounded-full ${unreadCount > 0 ? "bg-[#ff453a]" : "bg-[#32d74b]"}`} />
              <span className="font-semibold text-white">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "Notifications (all caught up)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
