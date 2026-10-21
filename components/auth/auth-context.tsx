"use client";

/**
 * Authentication State Context Provider
 *
 * The signed-in user is read from the client cache first, so pages render
 * immediately on repeat visits, and is then revalidated against /api/auth/me.
 */

import React, { createContext, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { clearCache, useCachedFetch } from "@/lib/client/cache";

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  isVerified: boolean;
  ntfyTopic: string;
  barkKey?: string;
  hasTmdbKey: boolean;
  hasGeminiKey: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, refresh } = useCachedFetch<{ user: UserProfile | null }>("/api/auth/me", "session");

  const refreshUser = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Drop offline-cached API responses so the next user on this device can't read them
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } finally {
      clearCache();
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user: data?.user ?? null, isLoading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
