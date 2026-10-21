"use client";

/**
 * Phone Top Bar (below md): wordmark and the notifications bell with unread badge.
 * On desktop the sidebar carries both, so this bar is hidden.
 */

import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useUnreadCount } from "./use-unread-count";

export function TopHeader() {
  const unread = useUnreadCount();

  return (
    <header className="md:hidden sticky top-0 z-30 w-full bg-night pt-safe">
      <div className="flex items-center justify-between h-[60px] px-4">
        <Link href="/" aria-label="TrackIt home">
          <Logo size="sm" />
        </Link>
        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative w-11 h-11 flex items-center justify-center rounded-full text-cream ios-press"
        >
          <Bell className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green text-ink font-mono text-[11px] font-semibold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
