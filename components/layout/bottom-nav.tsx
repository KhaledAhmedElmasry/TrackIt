"use client";

/**
 * Phone Bottom Tab Bar (below md)
 *
 * Home, Lists, a raised Search button in the centre, Picks and Profile.
 * Respects the home-indicator safe area.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Home, Layers, Search, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { name: "Home", href: "/", icon: Home },
  { name: "Lists", href: "/lists", icon: Layers },
  { name: "Search", href: "/search", icon: Search },
  { name: "Picks", href: "/recommendations", icon: Clapperboard },
  { name: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-night border-t border-[#241829] pb-safe"
    >
      <div className="grid grid-cols-5 h-16 items-start pt-2">
        {TABS.map(({ name, href, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          if (href === "/search") {
            return (
              <Link
                key={href}
                href={href}
                aria-label="Search"
                aria-current={isActive ? "page" : undefined}
                className="btn-primary justify-self-center -mt-7 w-[60px] h-[60px] rounded-full bg-green border-[5px] border-ink flex items-center justify-center ios-press"
              >
                <Icon className="w-6 h-6 text-ink" strokeWidth={2.6} />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 min-h-[44px] text-[11px] ios-press",
                isActive ? "text-green font-semibold" : "text-smoke font-medium"
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} />
              {name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
