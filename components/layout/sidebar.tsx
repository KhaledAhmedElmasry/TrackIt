"use client";

/**
 * Desktop Sidebar Navigation (md and above)
 *
 * Wordmark, a search box that opens the Search page, primary links with the
 * unread notification badge, and the profile card plus TMDB attribution at the foot.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Clapperboard, Home, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/components/auth/auth-context";
import { Logo } from "@/components/brand/logo";
import { useUnreadCount } from "./use-unread-count";

const LINKS = [
  { name: "Home", href: "/", icon: Home },
  { name: "My Lists", href: "/lists", icon: Layers },
  { name: "Picks for you", href: "/recommendations", icon: Clapperboard },
  { name: "Notifications", href: "/notifications", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const unread = useUnreadCount();
  const [query, setQuery] = useState("");

  const displayName = user?.username || user?.email?.split("@")[0] || "";

  return (
    <aside
      aria-label="Main navigation"
      className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 z-30 bg-night px-5 py-7 gap-7"
    >
      <Link href="/" aria-label="TrackIt home">
        <Logo />
      </Link>

      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        }}
      >
        <label htmlFor="sidebar-search" className="sr-only">
          Search films and series
        </label>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-smoke pointer-events-none" />
        <input
          id="sidebar-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search films & series"
          className="w-full h-11 rounded-[10px] border border-plum-line bg-ink pl-10 pr-3 text-sm font-medium text-cream placeholder:text-dim focus:border-green focus:outline-none"
        />
      </form>

      <nav className="flex flex-col gap-1">
        {LINKS.map(({ name, href, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 h-11 px-3.5 rounded-[10px] text-[15px] transition-colors",
                isActive ? "bg-plum-raised font-semibold text-cream" : "font-medium text-smoke hover:text-cream hover:bg-plum"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "text-green")} strokeWidth={isActive ? 2.25 : 1.75} />
              {name}
              {href === "/notifications" && unread > 0 && (
                <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-green text-ink font-mono text-xs font-semibold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        {user && (
          <Link
            href="/profile"
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-plum hover:bg-plum-raised transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-eggplant flex items-center justify-center font-display font-extrabold text-lg">
              {displayName.charAt(0)}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">{displayName}</span>
              <span className="text-xs text-smoke">Profile &amp; settings</span>
            </span>
          </Link>
        )}
        <p className="text-[11px] leading-relaxed text-dim">
          Film and TV data from TMDB. Not endorsed or certified by TMDB.
        </p>
      </div>
    </aside>
  );
}
