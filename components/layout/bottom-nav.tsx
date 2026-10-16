"use client";

/**
 * Mobile Bottom Tab Bar Component
 *
 * Implements Apple iOS Human Interface Guidelines:
 * - Translucent blurred background with saturated frosted glass effect.
 * - 5 primary tabs: Home, Search, Lists, Recommendations, Profile.
 * - Minimum 44px touch targets.
 * - System safe-area bottom inset accommodation (env(safe-area-inset-bottom)).
 * - Smooth active state transitions and haptic-like press animation.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Film, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
  ariaLabel: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: Home, ariaLabel: "Go to Home" },
  { name: "Search", href: "/search", icon: Search, ariaLabel: "Search Movies and TV Shows" },
  { name: "Lists", href: "/lists", icon: Film, ariaLabel: "View Watch Lists" },
  { name: "Picks", href: "/recommendations", icon: Sparkles, ariaLabel: "View AI Recommendations" },
  { name: "Profile", href: "/profile", icon: User, ariaLabel: "Account and Key Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-bar border-t border-[rgba(255,255,255,0.08)] pb-safe transition-all"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1">
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
                "flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] ios-press transition-colors rounded-xl",
                isActive
                  ? "text-[#0A84FF]"
                  : "text-[#8E8E93] hover:text-[#f5f5f7] active:text-[#f5f5f7]"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "scale-110 stroke-[2.25]" : "stroke-[1.75]"
                  )}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0A84FF]" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium tracking-tight mt-1 transition-all",
                  isActive ? "text-[#0A84FF] font-semibold" : "text-[#8E8E93]"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

