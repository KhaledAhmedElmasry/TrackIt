import type { Metadata, Viewport } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const shoulders = Big_Shoulders({
  variable: "--font-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
  // next/font has no metrics for this family, so name the fallback stack explicitly
  adjustFontFallback: false,
  fallback: ["Impact", "Arial Narrow", "sans-serif"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const viewport: Viewport = {
  themeColor: "#0b090c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: "TrackIt",
    template: "%s | TrackIt",
  },
  description:
    "Track every film and episode you watch, keep a watchlist and get alerts when new episodes air.",
  manifest: "/manifest.webmanifest",
  applicationName: "TrackIt",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrackIt",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${shoulders.variable} ${instrument.variable} ${plexMono.variable} dark h-full`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full bg-ink text-cream font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
