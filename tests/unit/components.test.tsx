import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { cn } from "@/lib/utils/cn";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopHeader } from "@/components/layout/top-header";
import { OfflineBanner } from "@/components/pwa/offline-context";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const unread = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/layout/use-unread-count", () => ({
  useUnreadCount: () => unread.count,
}));

describe("Utility and UI Components", () => {
  it("cn utility merges class names correctly", () => {
    expect(cn("base-class", false && "hidden", true && "active", undefined, null, "extra")).toBe(
      "base-class active extra"
    );
  });

  it("BottomNav renders all 5 main navigation tabs", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByText("Lists")).toBeInTheDocument();
    expect(screen.getByText("Picks")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("TopHeader renders unread notification badge when there are unread notifications", () => {
    unread.count = 0;
    const { rerender } = render(<TopHeader />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    unread.count = 4;
    rerender(<TopHeader />);
    expect(screen.getByText("4")).toBeInTheDocument();

    unread.count = 120;
    rerender(<TopHeader />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("OfflineBanner renders offline mode notification", () => {
    render(<OfflineBanner />);
    expect(screen.getByText("Offline Mode")).toBeInTheDocument();
    expect(screen.getByText("Read-Only")).toBeInTheDocument();
    expect(screen.getByText(/Write actions are disabled/i)).toBeInTheDocument();
  });
});
