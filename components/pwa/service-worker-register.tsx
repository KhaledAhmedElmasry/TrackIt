"use client";

/**
 * Service Worker Registration Component
 * Registers public/sw.js on the client for PWA caching and offline capabilities.
 */

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("TrackIt PWA Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.warn("TrackIt Service Worker registration failed:", error);
        });
    }
  }, []);

  return null;
}

