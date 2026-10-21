import type { MetadataRoute } from "next";

/**
 * Web App Manifest definition for TrackIt
 * Standalone PWA display on the ink background, with rounded ("any") and maskable icons.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrackIt",
    short_name: "TrackIt",
    description: "Track every film and episode you watch, keep a watchlist and get alerts when new episodes air.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b090c",
    theme_color: "#0b090c",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["entertainment", "utilities"],
    shortcuts: [
      {
        name: "Want to Watch",
        url: "/lists?tab=want_to_watch",
        description: "View saved movies and series to watch",
      },
      {
        name: "Search Titles",
        url: "/search",
        description: "Search TMDB movies and TV series",
      },
    ],
  };
}

