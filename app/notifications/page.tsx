"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Tv,
  CheckCheck,
  ExternalLink,
  Loader2,
  Smartphone,
  Copy,
  Check,
  Send,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

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
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Bark & Push state on phone
  const [barkKeyInput, setBarkKeyInput] = useState(user?.barkKey || "");
  const [isSavingBark, setIsSavingBark] = useState(false);
  const [barkFeedback, setBarkFeedback] = useState<string | null>(null);
  const [copiedTopic, setCopiedTopic] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user?.barkKey !== undefined) {
      queueMicrotask(() => {
        setBarkKeyInput(user.barkKey || "");
      });
    }
  }, [user?.barkKey]);

  const handleSaveBark = async () => {
    if (!barkKeyInput.trim()) return;
    setIsSavingBark(true);
    setBarkFeedback(null);
    try {
      const res = await fetch("/api/user/bark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barkKey: barkKeyInput.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setBarkFeedback("Bark key connected! Native iOS push is now enabled.");
        await refreshUser();
      } else {
        alert(json.error || "Failed to save Bark key");
      }
    } catch {
      alert("Failed to save Bark key");
    } finally {
      setIsSavingBark(false);
    }
  };

  const handleDeleteBark = async () => {
    if (!confirm("Remove Bark key?")) return;
    setIsSavingBark(true);
    try {
      const res = await fetch("/api/user/bark", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setBarkKeyInput("");
        setBarkFeedback("Bark key removed.");
        await refreshUser();
      } else {
        alert(json.error || "Failed to remove Bark key");
      }
    } catch {
      alert("Failed to remove Bark key");
    } finally {
      setIsSavingBark(false);
    }
  };

  const handleSendTestPush = async () => {
    setIsSendingTest(true);
    setTestPushStatus(null);
    try {
      const res = await fetch("/api/notifications/test-push", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestPushStatus("Test alert sent to your phone (Bark / ntfy)!");
      } else {
        alert(json.error || "Failed to send test push");
      }
    } catch {
      alert("Failed to send test push");
    } finally {
      setIsSendingTest(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setNotifications(json.data.notifications || []);
          setUnreadCount(json.data.unreadCount || 0);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setNow(Date.now());
        void fetchNotifications();
      }
    });
    return () => {
      mounted = false;
    };
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
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
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

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
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Notifications
          </h1>
          <p className="text-sm text-[#8e8e93] mt-0.5">
            Aired episode updates and system alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="px-3.5 py-1.5 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[rgba(255,255,255,0.08)] text-xs font-semibold text-[#0a84ff] flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {isMarkingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Mobile Push Notification Channels Card */}
      {user && (
        <div className="ios-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#ffd60a]" />
              <h2 className="text-sm sm:text-base font-bold text-white">
                Mobile Push Channels (Bark & ntfy.sh)
              </h2>
            </div>
            <button
              onClick={handleSendTestPush}
              disabled={isSendingTest}
              className="px-3 py-1.5 rounded-xl bg-[#ffd60a]/15 hover:bg-[#ffd60a]/25 border border-[#ffd60a]/30 text-[#ffd60a] text-xs font-bold transition-all ios-press flex items-center gap-1.5 disabled:opacity-40"
            >
              {isSendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>Test Push</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {/* Bark iOS Setup */}
            <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Bark (iOS Push)</span>
                {user.barkKey ? (
                  <span className="px-2 py-0.5 rounded-full bg-[#32d74b]/15 text-[#32d74b] text-[10px] font-bold border border-[#32d74b]/30">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-[#ff9f0a]/15 text-[#ff9f0a] text-[10px] font-bold border border-[#ff9f0a]/30">
                    Not Configured
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8e8e93]">
                Receive instant alerts on your iPhone via the Bark app.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={barkKeyInput}
                  onChange={(e) => setBarkKeyInput(e.target.value)}
                  placeholder="Paste Bark device key..."
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[#222226] border border-white/10 text-white text-xs font-mono placeholder-[#636366] focus:outline-none focus:border-[#ffd60a]"
                />
                <button
                  onClick={handleSaveBark}
                  disabled={isSavingBark || !barkKeyInput.trim() || barkKeyInput.trim() === user.barkKey}
                  className="px-3 py-1.5 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold shrink-0 transition-all disabled:opacity-40"
                >
                  {isSavingBark ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </button>
                {user.barkKey && (
                  <button
                    onClick={handleDeleteBark}
                    disabled={isSavingBark}
                    className="p-1.5 rounded-xl bg-[#ff453a]/15 text-[#ff453a] hover:bg-[#ff453a]/25 transition-colors shrink-0"
                    title="Remove Bark key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {barkFeedback && (
                <p className="text-[10px] text-[#32d74b] font-medium">{barkFeedback}</p>
              )}
            </div>

            {/* ntfy.sh Setup */}
            <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">ntfy.sh (Free Server)</span>
                <span className="px-2 py-0.5 rounded-full bg-[#32d74b]/15 text-[#32d74b] text-[10px] font-bold border border-[#32d74b]/30">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-[#8e8e93]">
                Subscribe to your private topic in the ntfy app (iOS/Android).
              </p>

              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[#222226] border border-white/10 text-[#ffd60a] text-xs font-mono truncate select-all">
                  {user.ntfyTopic}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user.ntfyTopic);
                    setCopiedTopic(true);
                    setTimeout(() => setCopiedTopic(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold shrink-0 flex items-center gap-1 transition-all"
                >
                  {copiedTopic ? <Check className="w-3 h-3 text-[#32d74b]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTopic ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          {testPushStatus && (
            <p className="text-xs text-[#32d74b] font-medium pt-1 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>{testPushStatus}</span>
            </p>
          )}
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-[#1c1c1e] border border-[rgba(255,255,255,0.06)] animate-pulse h-20"
            />
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2.5">
          {notifications.map((notif) => {
            const isEpisode = notif.type === "new_episode";
            return (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  !notif.read
                    ? "bg-[#1c1c1e] border-[#0a84ff]/30 shadow-md hover:border-[#0a84ff]/60"
                    : "bg-[#141416]/60 border-white/[0.04] hover:border-white/[0.1] opacity-75 hover:opacity-100"
                }`}
              >
                {/* Icon */}
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isEpisode
                      ? "bg-[#0a84ff]/15 text-[#0a84ff]"
                      : "bg-[#32d74b]/15 text-[#32d74b]"
                  }`}
                >
                  {isEpisode ? <Tv className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                      {notif.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#8e8e93]">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#0a84ff]" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-[#8e8e93] mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  {notif.link && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#0a84ff]">
                      <span>Open series details</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="ios-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mx-auto text-[#8e8e93]">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">All caught up!</h3>
            <p className="text-xs text-[#8e8e93] max-w-sm mx-auto mt-1">
              When new episodes air for series you follow with notifications enabled, alerts will appear right here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
