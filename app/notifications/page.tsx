"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Tv,
  CheckCheck,
  ExternalLink,
  Loader2,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useCachedFetch } from "@/lib/client/cache";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  link: string | null;
  type: "new_episode" | "system";
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { data, isLoading, mutate } = useCachedFetch<{ notifications: NotificationItem[]; unreadCount: number }>(
    user ? "/api/notifications" : null,
    user?.id
  );
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Selection mode for deleting several notifications at once
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const allSelected = notifications.length > 0 && selectedIds.size === notifications.length;

  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setNow(Date.now());
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        mutate((prev) => ({
          notifications: (prev?.notifications ?? []).map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      }
    } catch {
      alert("Failed to mark notifications as read");
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      // Optimistically update
      mutate((prev) => ({
        notifications: (prev?.notifications ?? []).map((n) => (n._id === notif._id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, (prev?.unreadCount ?? 1) - 1),
      }));

      // Persist read state
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notif._id }),
      }).catch(console.warn);
    }

    if (notif.link) {
      router.push(notif.link);
    }
  };

  const deleteNotifications = async (ids: string[] | "all") => {
    const previous = data;
    const removed = ids === "all" ? null : new Set(ids);
    mutate((prev) => {
      const remaining = removed ? (prev?.notifications ?? []).filter((n) => !removed.has(n._id)) : [];
      return { notifications: remaining, unreadCount: remaining.filter((n) => !n.read).length };
    });

    setIsDeleting(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
      });
      if (!res.ok) throw new Error();
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch {
      if (previous) mutate(() => previous);
      alert("Failed to delete notifications");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (allSelected) {
      if (!confirm(`Delete all ${notifications.length} notifications?`)) return;
      void deleteNotifications("all");
    } else {
      void deleteNotifications([...selectedIds]);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTimeAgo = (isoString: string) => {
    if (!now) return "Recently";
    const diffMs = now - new Date(isoString).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display font-black text-5xl md:text-[76px] leading-[0.9]">Notifications</h1>
        <Link href="/profile#push" className="text-sm font-semibold text-smoke hover:text-cream">
          Push alert settings &rarr;
        </Link>
      </div>

      {/* Notifications List */}
      {notifications.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {isSelecting ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(notifications.map((n) => n._id)))}
                className="btn-quiet h-10 px-4 rounded-full border border-plum-line text-[13px] font-semibold hover:border-lilac hover:bg-plum transition-colors"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0 || isDeleting}
                className="h-10 px-4 rounded-full bg-danger text-ink text-[13px] font-bold flex items-center gap-1.5 hover:brightness-110 transition disabled:opacity-40"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {allSelected ? "Delete all" : `Delete${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSelecting(false);
                  setSelectedIds(new Set());
                }}
                className="h-10 px-3 text-[13px] font-semibold text-smoke hover:text-cream"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className="btn-quiet h-10 px-4 rounded-full border border-plum-line text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isMarkingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsSelecting(true)}
                className="btn-quiet h-10 px-4 rounded-full border border-plum-line text-[13px] font-semibold flex items-center gap-1.5 hover:border-lilac hover:bg-plum transition-colors"
              >
                <CheckSquare className="w-4 h-4" />
                Select
              </button>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[14px] bg-plum animate-pulse h-20" />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {notifications.map((notif) => {
            const isEpisode = notif.type === "new_episode";
            const isSelected = selectedIds.has(notif._id);
            return (
              <li
                key={notif._id}
                className={`group flex items-stretch rounded-[14px] border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${
                  isSelected
                    ? "bg-plum-raised border-green"
                    : !notif.read
                    ? "bg-plum border-green/30 hover:border-green/70"
                    : "bg-night border-plum-line hover:border-lilac hover:bg-plum"
                }`}
              >
                {isSelecting && (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={isSelected ? "Deselect notification" : "Select notification"}
                    onClick={() => toggleSelected(notif._id)}
                    className="pl-4 flex items-center"
                  >
                    {isSelected ? <CheckSquare className="w-5 h-5 text-green" /> : <Square className="w-5 h-5 text-smoke" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (isSelecting ? toggleSelected(notif._id) : handleNotificationClick(notif))}
                  className="flex-1 min-w-0 p-4 flex items-start gap-3.5 text-left"
                >
                  <span className="p-2.5 rounded-xl shrink-0 bg-green/15 text-green">
                    {isEpisode ? <Tv className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold truncate ${notif.read ? "text-smoke" : "text-cream"}`}>
                        {notif.title}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-smoke">{formatTimeAgo(notif.createdAt)}</span>
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-green" />}
                      </span>
                    </span>
                    <span className="text-[13px] text-smoke mt-1 leading-relaxed">{notif.message}</span>
                    {notif.link && !isSelecting && (
                      <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-green group-hover:underline">
                        Open series
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                </button>

                {!isSelecting && (
                  <button
                    type="button"
                    aria-label="Delete notification"
                    title="Delete"
                    onClick={() => void deleteNotifications([notif._id])}
                    className="w-12 shrink-0 flex items-center justify-center rounded-r-[14px] text-dim hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        /* Empty State */
        <div className="ios-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-plum-raised border border-plum-line flex items-center justify-center mx-auto text-[#b7a9bc]">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cream">All caught up!</h3>
            <p className="text-xs text-[#b7a9bc] max-w-sm mx-auto mt-1">
              When new episodes air for series you follow with notifications enabled, alerts will appear right here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
