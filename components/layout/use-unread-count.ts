"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

/**
 * Unread in-app notification count for the nav badge, refreshed on every navigation.
 */
export function useUnreadCount(): number {
  const { user } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/notifications?countOnly=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setCount(json.data.unreadCount || 0);
      })
      .catch(() => {
        // Badge is best-effort
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return user ? count : 0;
}
