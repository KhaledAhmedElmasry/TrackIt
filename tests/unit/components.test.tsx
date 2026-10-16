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

describe("Utility and UI Components", () => {
  it("cn utility merges class names correctly", () => {
    expect(cn("base-class", false && "hidden", true && "active", undefined, null, "extra")).toBe(
      "base-class active extra"
    );
  });

  it("BottomNav renders all 5 main navigation tabs", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Lists")).toBeInTheDocument();
    expect(screen.getByText("Picks")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("TopHeader renders unread notification badge when unreadCount > 0", () => {
    const { rerender } = render(<TopHeader unreadCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rerender(<TopHeader unreadCount={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();

    rerender(<TopHeader unreadCount={120} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("OfflineBanner renders offline mode notification", () => {
    render(<OfflineBanner />);
    expect(screen.getByText("Offline Mode")).toBeInTheDocument();
    expect(screen.getByText("Read-Only")).toBeInTheDocument();
    expect(screen.getByText(/Write actions are disabled/i)).toBeInTheDocument();
  });
});
