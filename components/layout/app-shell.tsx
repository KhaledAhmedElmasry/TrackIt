"use client";

/**
 * App Shell Master Layout Component
 *
 * Coordinates responsive UI across devices:
 * - Desktop: Fixed left sidebar with search, links, notifications badge and profile.
 * - Mobile: Top bar with unread bell, and bottom tab bar with a centre search button.
 * - Global PWA: Offline state detection, banner alert, and service worker registration.
 * - Global Auth: Session state hydration, email verification banner, and first-run key modal.
 */

import React from "react";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { TopHeader } from "./top-header";
import { OfflineProvider } from "../pwa/offline-context";
import { ServiceWorkerRegister } from "../pwa/service-worker-register";
import { AuthProvider } from "../auth/auth-context";
import { UnverifiedBanner } from "../auth/unverified-banner";
import { FirstRunSetupModal } from "../auth/first-run-setup-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OfflineProvider>
        <ServiceWorkerRegister />
        <FirstRunSetupModal />
        <div className="min-h-screen bg-ink text-cream flex flex-col md:flex-row antialiased selection:bg-green/30">
          {/* PC / Desktop Sidebar */}
          <React.Suspense fallback={<div className="hidden md:block fixed inset-y-0 left-0 w-64 bg-night" />}>
            <Sidebar />
          </React.Suspense>

          {/* Content Area with Top Header and Safe Area padding */}
          <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all">
            <React.Suspense fallback={<div className="md:hidden h-[60px] bg-night" />}>
              <TopHeader />
            </React.Suspense>

            <main className="flex-1 px-4 py-6 md:px-14 md:py-10 max-w-[1240px] w-full pb-28 md:pb-16">
              <UnverifiedBanner />
              <React.Suspense fallback={<div className="p-8 text-center text-xs text-smoke">Loading…</div>}>
                {children}
              </React.Suspense>
            </main>

            {/* Phone Bottom Tab Bar */}
            <React.Suspense fallback={<div className="h-16 md:hidden bg-night" />}>
              <BottomNav />
            </React.Suspense>
          </div>
        </div>
      </OfflineProvider>
    </AuthProvider>
  );
}
