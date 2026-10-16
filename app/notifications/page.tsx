/**
 * Notifications Page Shell (Phase 1 preview, ready for Phase 4 integration)
 */

import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Notifications
          </h1>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            New episode releases from tracked series.
          </p>
        </div>
      </div>

      <div className="ios-card p-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#8e8e93]">
          <Bell className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-white">No notifications yet</p>
        <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
          When new aired episodes drop for your tracked series, the daily cron job creates an in-app alert and pushes to your ntfy.sh topic.
        </p>
      </div>
    </div>
  );
}
