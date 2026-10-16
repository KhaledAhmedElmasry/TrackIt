"use client";

/**
 * Offline State Context and Hook
 *
 * Tracks network connectivity in real-time using React 19 useSyncExternalStore.
 * Avoids cascading re-renders and handles SSR hydration safely.
 * Exposes isOffline boolean to disable mutating actions (write buttons)
 * and display the iOS offline indicator banner across the application.
 */

import React, { createContext, useContext, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

interface OfflineContextType {
  isOffline: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOffline: false,
});

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return !navigator.onLine;
}

function getServerSnapshot(): boolean {
  return false;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <OfflineContext.Provider value={{ isOffline }}>
      {children}
      {isOffline && <OfflineBanner />}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}

/**
 * Apple iOS-styled Translucent Offline Banner
 * Floats near the top bar with subtle blur and clear warning.
 */
export function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-14 left-0 right-0 z-50 px-4 py-2 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-2"
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#2c1a0e]/90 border border-[#f59e0b]/30 backdrop-blur-xl shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-full bg-[#f59e0b]/20 text-[#fbbf24]">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#fef3c7]">Offline Mode</p>
            <p className="text-[11px] text-[#fde68a]/80">Viewing cached data. Write actions are disabled.</p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#fde68a]">
          Read-Only
        </span>
      </div>
    </div>
  );
}

