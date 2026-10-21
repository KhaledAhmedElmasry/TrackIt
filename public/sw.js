/**
 * TrackIt Service Worker
 *
 * Implements App Shell caching for instant loading on phone and desktop.
 * Provides read-only offline support:
 * - Serves cached App Shell and static assets when offline.
 * - Safely bypasses mutating API calls (POST/PUT/PATCH/DELETE).
 * - Read-only offline experience displays an offline banner with write actions disabled.
 */

const CACHE_NAME = "trackit-shell-v3";

// Account, key and export responses must never be persisted in Cache Storage.
const UNCACHEABLE_API_PREFIXES = ["/api/auth/", "/api/keys", "/api/user/", "/api/cron/"];

// Core App Shell assets required for offline launch
const APP_SHELL_ASSETS = [
  "/",
  "/search",
  "/lists",
  "/recommendations",
  "/profile",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.png",
];

// Install Event: Pre-cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Cache assets, ignoring individual non-critical failures
        return Promise.allSettled(
          APP_SHELL_ASSETS.map((url) =>
            fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Purge old cache versions and claim immediate control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Smart routing based on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API mutation calls (POST, PUT, DELETE, PATCH)
  if (request.method !== "GET") {
    return;
  }

  // Sensitive API reads: always network, never cached
  if (UNCACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return;
  }

  // API read requests (/api/*): Network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Serve cached response if offline
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                error: {
                  code: "OFFLINE",
                  message: "You are currently offline. Viewing cached read-only data.",
                },
              }),
              {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }
            );
          });
        })
    );
    return;
  }

  // Navigation requests (HTML pages): Network-first falling back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match("/");
          });
        })
    );
    return;
  }

  // Only hashed build output and app icons are safe to serve cache-first.
  // Everything else (notably Next.js RSC payload requests, which are GETs that
  // are not navigations) goes straight to the network so pages are never stale.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.png";
  if (!isStaticAsset || request.headers.get("RSC")) {
    return;
  }

  // Static assets: Cache-first with stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

