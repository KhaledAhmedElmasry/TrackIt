"use client";

/**
 * App Shell Master Layout Component
 *
 * Coordinates responsive UI across devices:
 * - Desktop: Fixed left navigation sidebar with brand and TMDB attribution.
 * - Mobile: Top translucent header with unread bell, and bottom 5-tab bar.
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

interface AppShellProps {
  children: React.ReactNode;
  unreadNotificationsCount?: number;
}

export function AppShell({ children, unreadNotificationsCount = 0 }: AppShellProps) {
  return (
    <AuthProvider>
      <OfflineProvider>
        <ServiceWorkerRegister />
        <FirstRunSetupModal />
        <div className="min-h-screen bg-black text-[#f5f5f7] flex flex-col md:flex-row antialiased selection:bg-[#0a84ff]/30">
          {/* PC / Desktop Sidebar */}
          <Sidebar />

          {/* Content Area with Top Header and Safe Area padding */}
          <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all">
            <TopHeader unreadCount={unreadNotificationsCount} />

            <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
              <UnverifiedBanner />
              {children}
            </main>

            {/* Phone Bottom Tab Bar */}
            <BottomNav />
          </div>
        </div>
      </OfflineProvider>
    </AuthProvider>
  );
}
