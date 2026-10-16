import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: {
    default: "WatchTrack - Private Movie & Series Tracker",
    template: "%s | WatchTrack",
  },
  description:
    "A private, responsive movie and TV series tracker installable as a native-feeling PWA with dark Apple iOS styling.",
  manifest: "/manifest.webmanifest",
  applicationName: "WatchTrack",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WatchTrack",
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full bg-black text-[#f5f5f7] antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
