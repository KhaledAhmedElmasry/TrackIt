"use client";

/**
 * Profile & Settings Page
 *
 * Implements:
 * - User account summary and sign out.
 * - AES-256-GCM encrypted API key management (TMDB & Gemini).
 *   Only displays masked status and last 4 characters with Add, Replace, and Delete.
 * - Private unguessable ntfy topic display with one-tap copy and client instructions.
 * - Permanent cascaded account deletion with password verification.
 */

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Key,
  Shield,
  Bell,
  Trash2,
  ExternalLink,
  Loader2,
  Check,
  Copy,
  LogOut,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Download,
  Upload,
  Send,
  FileJson,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { clearCache } from "@/lib/client/cache";

interface KeySummary {
  configured: boolean;
  lastFour?: string;
  updatedAt?: string;
}

interface KeysResponse {
  tmdb: KeySummary;
  gemini: KeySummary;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, logout, refreshUser } = useAuth();

  const [keys, setKeys] = useState<KeysResponse | null>(null);

  // Key Modal State
  const [editingKeyType, setEditingKeyType] = useState<"tmdb" | "gemini" | null>(null);
  const [inputKey, setInputKey] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // Copy Topic Feedback
  const [copiedTopic, setCopiedTopic] = useState(false);

  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Display Username State
  const [usernameInput, setUsernameInput] = useState(user?.username || "");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameFeedback, setUsernameFeedback] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.username !== undefined) {
      queueMicrotask(() => {
        setUsernameInput(user.username || "");
      });
    }
  }, [user?.username]);

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setIsSavingUsername(true);
    setUsernameFeedback(null);
    setUsernameError(null);
    try {
      const res = await fetch("/api/user/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await refreshUser();
        setUsernameFeedback(json.message || "Username saved successfully!");
      } else {
        setUsernameError(json.error || "Failed to update username");
      }
    } catch {
      setUsernameError("Failed to update username");
    } finally {
      setIsSavingUsername(false);
    }
  };

  // Bark Push Key State
  const [barkKeyInput, setBarkKeyInput] = useState(user?.barkKey || "");
  const [isSavingBarkKey, setIsSavingBarkKey] = useState(false);
  const [barkFeedback, setBarkFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (user?.barkKey !== undefined) {
      queueMicrotask(() => {
        setBarkKeyInput(user.barkKey || "");
      });
    }
  }, [user?.barkKey]);

  const handleSaveBarkKey = async () => {
    if (!barkKeyInput.trim()) return;
    setIsSavingBarkKey(true);
    setBarkFeedback(null);
    try {
      const res = await fetch("/api/user/bark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barkKey: barkKeyInput.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        await refreshUser();
        setBarkFeedback("Bark key saved! Test notification will now alert Bark.");
      } else {
        alert(json.error || "Failed to save Bark key");
      }
    } catch {
      alert("Failed to save Bark key");
    } finally {
      setIsSavingBarkKey(false);
    }
  };

  const handleDeleteBarkKey = async () => {
    if (!confirm("Remove Bark key?")) return;
    setIsSavingBarkKey(true);
    setBarkFeedback(null);
    try {
      const res = await fetch("/api/user/bark", { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setBarkKeyInput("");
        await refreshUser();
        setBarkFeedback("Bark key removed.");
      } else {
        alert(json.error || "Failed to remove Bark key");
      }
    } catch {
      alert("Failed to remove Bark key");
    } finally {
      setIsSavingBarkKey(false);
    }
  };

  // Test Push & Data Management State
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [testPushFeedback, setTestPushFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleSendTestPush = async () => {
    setIsSendingTestPush(true);
    setTestPushFeedback(null);
    try {
      const res = await fetch("/api/notifications/test-push", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestPushFeedback("Test notification dispatched to your device!");
      } else {
        alert(json.error || "Failed to send test push");
      }
    } catch {
      alert("Failed to send test push");
    } finally {
      setIsSendingTestPush(false);
    }
  };

  const handleExportData = () => {
    const anchor = document.createElement("a");
    anchor.href = "/api/user/export";
    anchor.download = "trackit-export.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);
    setImportError(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/user/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setImportStatus(json.message);
      } else {
        setImportError(json.error || "Failed to import file");
      }
    } catch (err) {
      setImportError((err as Error).message || "Invalid JSON backup file");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setKeys(json.data);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch keys summary:", err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    queueMicrotask(() => {
      if (mounted) {
        void fetchKeys();
      }
    });

    return () => {
      mounted = false;
    };
  }, [user, fetchKeys]);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKeyType || !inputKey.trim()) return;

    setIsSavingKey(true);
    setKeyError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyType: editingKeyType, key: inputKey.trim() }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        await fetchKeys();
        await refreshUser();
        setEditingKeyType(null);
        setInputKey("");
      } else {
        setKeyError(json.error?.message || "Failed to save key");
      }
    } catch {
      setKeyError("Network error. Please try again.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteKey = async (keyType: "tmdb" | "gemini") => {
    if (!confirm(`Are you sure you want to remove your ${keyType.toUpperCase()} API key?`)) {
      return;
    }

    try {
      const res = await fetch("/api/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyType }),
      });

      if (res.ok) {
        await fetchKeys();
        await refreshUser();
      }
    } catch (err) {
      console.error("Failed to delete key:", err);
    }
  };

  const handleCopyTopic = () => {
    if (!user?.ntfyTopic) return;
    navigator.clipboard.writeText(user.ntfyTopic);
    setCopiedTopic(true);
    setTimeout(() => setCopiedTopic(false), 2000);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) return;

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        clearCache();
        router.push("/signup");
        router.refresh();
      } else {
        setDeleteError(json.error?.message || "Incorrect password.");
      }
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4fd27f] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ios-card p-10 text-center space-y-4 max-w-md mx-auto my-12 animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-plum-raised text-[#b7a9bc] flex items-center justify-center mx-auto">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-cream">Sign In Required</h2>
          <p className="text-xs text-[#b7a9bc] mt-1">
            Please sign in or create an account to configure your private keys and tracker settings.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="btn-primary px-5 py-2.5 rounded-xl bg-[#4fd27f] text-ink text-xs font-bold ios-press"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-xl bg-plum-line text-cream text-xs font-semibold ios-press"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto pb-32">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-5xl md:text-[64px] leading-[0.9]">
            Settings & Account
          </h1>
          <p className="text-xs md:text-sm text-[#b7a9bc] mt-0.5">
            Manage your credentials, AES-256-GCM encrypted keys, and notification channels.
          </p>
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-plum-line hover:bg-[#ff8a80]/20 hover:text-[#ff8a80] text-xs font-semibold text-cream transition-colors ios-press shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Account Info Card */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-[#b7a9bc]">Signed in as</p>
            <p className="text-sm font-bold text-cream">{user.email}</p>
          </div>
          <div>
            {user.isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4fd27f]/15 text-[#4fd27f] text-[11px] font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e9b44c]/15 text-[#e9b44c] text-[11px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Unverified</span>
              </span>
            )}
          </div>
        </div>

        {/* Display Username Configuration */}
        <div className="pt-4 border-t border-plum-line space-y-3">
          <div>
            <label htmlFor="username-input" className="text-xs font-bold text-cream flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[#4fd27f]" />
              <span>Display Username</span>
            </label>
            <p className="text-[11px] text-[#b7a9bc] mt-0.5">
              Set your personal username displayed across the app and greeting banners.
            </p>
          </div>

          <form onSubmit={handleSaveUsername} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                id="username-input"
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter display username (e.g. MovieLover)"
                minLength={2}
                maxLength={30}
                className="w-full px-3.5 py-2 rounded-xl bg-[#2c1b33] border border-plum-line text-xs text-cream placeholder:text-dim focus:outline-none focus:border-[#4fd27f] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingUsername || !usernameInput.trim() || usernameInput.trim() === (user.username || "")}
              className="btn-primary px-4 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] disabled:opacity-50 disabled:pointer-events-none text-ink text-xs font-bold transition-all ios-press shrink-0 flex items-center justify-center gap-1.5"
            >
              {isSavingUsername ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Username</span>
              )}
            </button>
          </form>

          {usernameFeedback && (
            <p className="text-[11px] text-[#4fd27f] font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{usernameFeedback}</span>
            </p>
          )}
          {usernameError && (
            <p className="text-[11px] text-[#ff8a80] font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{usernameError}</span>
            </p>
          )}
        </div>
      </div>

      {/* API Keys Management */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#4fd27f]" />
            <h2 className="text-base font-bold text-cream">Encrypted API Keys</h2>
          </div>
          <span className="text-[11px] text-[#4fd27f] font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AES-256-GCM</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TMDB Key Card */}
          <div className="ios-card p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cream uppercase tracking-wider">
                  TMDB API Key
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    keys?.tmdb.configured
                      ? "bg-[#4fd27f]/15 text-[#4fd27f]"
                      : "bg-[#ff8a80]/15 text-[#ff8a80]"
                  }`}
                >
                  {keys?.tmdb.configured ? "Connected" : "Required"}
                </span>
              </div>
              <p className="text-xs text-[#b7a9bc]">
                Required for movie/series metadata, search, and episode tracking.
              </p>

              {keys?.tmdb.configured && (
                <div className="p-2.5 rounded-xl bg-[#2c1b33] border border-plum-line font-mono text-xs text-cream flex items-center justify-between">
                  <span>••••••••••••{keys.tmdb.lastFour}</span>
                  <span className="text-[10px] text-[#b7a9bc] font-sans">Encrypted at rest</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-plum-line">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKeyType("tmdb");
                    setInputKey("");
                    setKeyError(null);
                  }}
                  className="btn-primary flex-1 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center justify-center gap-1.5"
                >
                  {keys?.tmdb.configured ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace Key</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add TMDB Key</span>
                    </>
                  )}
                </button>

                {keys?.tmdb.configured && (
                  <button
                    type="button"
                    onClick={() => handleDeleteKey("tmdb")}
                    className="p-2 rounded-xl bg-plum-raised hover:bg-[#ff8a80]/20 text-[#b7a9bc] hover:text-[#ff8a80] transition-colors ios-press"
                    aria-label="Delete TMDB key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#b7a9bc] hover:text-[#4fd27f] transition-colors"
              >
                <span>Get a free developer key at themoviedb.org</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Gemini Key Card */}
          <div className="ios-card p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cream uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#b48cc0]" />
                  <span>Google Gemini Key</span>
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    keys?.gemini.configured
                      ? "bg-[#4fd27f]/15 text-[#4fd27f]"
                      : "bg-plum-line text-[#b7a9bc]"
                  }`}
                >
                  {keys?.gemini.configured ? "Connected" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-[#b7a9bc]">
                Optional until you request AI watch recommendations in Phase 5.
              </p>

              {keys?.gemini.configured && (
                <div className="p-2.5 rounded-xl bg-[#2c1b33] border border-plum-line font-mono text-xs text-cream flex items-center justify-between">
                  <span>••••••••••••{keys.gemini.lastFour}</span>
                  <span className="text-[10px] text-[#b7a9bc] font-sans">Encrypted at rest</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-plum-line">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKeyType("gemini");
                    setInputKey("");
                    setKeyError(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-eggplant hover:bg-plum-line text-cream text-xs font-bold transition-all ios-press flex items-center justify-center gap-1.5"
                >
                  {keys?.gemini.configured ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace Key</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Gemini Key</span>
                    </>
                  )}
                </button>

                {keys?.gemini.configured && (
                  <button
                    type="button"
                    onClick={() => handleDeleteKey("gemini")}
                    className="p-2 rounded-xl bg-plum-raised hover:bg-[#ff8a80]/20 text-[#b7a9bc] hover:text-[#ff8a80] transition-colors ios-press"
                    aria-label="Delete Gemini key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#b7a9bc] hover:text-[#b48cc0] transition-colors"
              >
                <span>Get a free API key at Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <p className="text-[11px] leading-relaxed text-dim">
                Picks are suggested by Gemini, and every title is checked against TMDB before it&rsquo;s shown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Push Notifications Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-lilac" />
          <h2 className="text-base font-bold text-cream">Push Notifications (ntfy.sh & Bark)</h2>
        </div>

        <div className="ios-card p-5 space-y-5">
          {/* Channel 1: ntfy.sh */}
          <div className="space-y-2.5">
            <div>
              <p className="text-xs font-semibold text-cream">ntfy.sh (Free Public Server)</p>
              <p className="text-xs text-[#b7a9bc] mt-0.5">
                Each user receives a unique, long random topic. Subscribe to this topic in the free <strong>ntfy</strong> app (iOS / Android / Web) to get alerts for new aired episodes.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[#2c1b33] border border-plum-line flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-lilac truncate select-all">
                {user.ntfyTopic}
              </span>
              <button
                type="button"
                onClick={handleCopyTopic}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-plum-line hover:bg-plum-line text-cream text-xs font-semibold transition-all ios-press shrink-0"
              >
                {copiedTopic ? <Check className="w-3.5 h-3.5 text-[#4fd27f]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTopic ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div>
              <a
                href={`https://ntfy.sh/${user.ntfyTopic}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4fd27f] hover:underline"
              >
                <span>Open topic on ntfy.sh</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Channel 2: Bark */}
          <div className="pt-4 border-t border-plum-line space-y-2.5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-cream">Bark (iOS Push)</p>
                {user.barkKey && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#4fd27f]/15 text-[#4fd27f] border border-[#4fd27f]/30">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#b7a9bc] mt-0.5">
                Paste your device key from the Bark iOS app (or your custom server URL) to receive native iOS notifications.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={barkKeyInput}
                onChange={(e) => setBarkKeyInput(e.target.value)}
                placeholder="e.g. your_bark_key or https://api.day.app/..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#2c1b33] border border-plum-line text-cream text-xs font-mono placeholder:text-[#8a7c90] focus:outline-none focus:border-green"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveBarkKey}
                  disabled={isSavingBarkKey || !barkKeyInput.trim() || barkKeyInput.trim() === user.barkKey}
                  className="px-3 py-2 rounded-xl bg-plum-line hover:bg-plum-line text-cream text-xs font-semibold transition-all ios-press disabled:opacity-40"
                >
                  {isSavingBarkKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Bark Key"}
                </button>
                {user.barkKey && (
                  <button
                    type="button"
                    onClick={handleDeleteBarkKey}
                    disabled={isSavingBarkKey}
                    className="btn-danger px-2.5 py-2 rounded-xl bg-[#ff8a80]/15 hover:bg-[#ff8a80]/25 text-[#ff8a80] text-xs font-semibold transition-all ios-press"
                    title="Remove Bark key"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {barkFeedback && (
              <p className="text-[11px] text-[#4fd27f] font-semibold">{barkFeedback}</p>
            )}
          </div>

          {/* Combined Test Notification Dispatcher */}
          <div className="pt-4 border-t border-plum-line flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#b7a9bc]">
              Send a test push to all configured services:
            </span>

            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-transparent hover:bg-green hover:text-ink border border-green text-green text-xs font-bold transition-all ios-press disabled:opacity-50"
            >
              {isSendingTestPush ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send Test Notification</span>
            </button>
          </div>

          {testPushFeedback && (
            <p className="text-[11px] text-[#4fd27f] font-semibold pt-1">
              {testPushFeedback}
            </p>
          )}
        </div>
      </section>

      {/* Security & Recovery Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#4fd27f]" />
          <h2 className="text-base font-bold text-cream">Account Recovery</h2>
        </div>

        <div className="ios-card p-5 space-y-2">
          <p className="text-xs text-cream font-semibold">One-Time Backup Recovery Codes</p>
          <p className="text-xs text-[#b7a9bc] leading-relaxed">
            Your 10 one-time recovery codes generated at signup remain active until used. They allow you to reset your password instantly at any time, even if you cannot access your email.
          </p>
        </div>
      </section>

      {/* Data Management Section (Phase 6) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-5 h-5 text-[#4fd27f]" />
          <h2 className="text-base font-bold text-cream">Data Management</h2>
        </div>

        <div className="ios-card p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-cream">Export & Import Your Watchlist</h3>
            <p className="text-xs text-[#b7a9bc] mt-0.5 leading-relaxed">
              Your library belongs to you. Export your entire tracked watchlist, ratings, and episode progress as an offline JSON backup, or import to restore or migrate data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportData}
              className="btn-primary px-4 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Library (JSON)</span>
            </button>

            {/* Import Button */}
            <label className="px-4 py-2 rounded-xl bg-plum-line hover:bg-plum-line text-cream text-xs font-bold transition-all ios-press flex items-center gap-2 cursor-pointer border border-plum-line">
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4fd27f]" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isImporting ? "Importing..." : "Import Library (JSON)"}</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>

          {importStatus && (
            <div className="p-3 rounded-xl bg-[#4fd27f]/15 border border-[#4fd27f]/30 text-xs text-[#4fd27f] font-semibold">
              {importStatus}
            </div>
          )}

          {importError && (
            <div className="p-3 rounded-xl bg-[#ff8a80]/15 border border-[#ff8a80]/30 text-xs text-[#ff8a80] font-semibold">
              {importError}
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone: Account Deletion */}
      <section className="space-y-3 pt-4 border-t border-plum-line">
        <div className="p-5 rounded-2xl bg-[#1f1424]/50 border border-[#ff8a80]/25 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[#ff8a80]">Danger Zone</h3>
            <p className="text-xs text-[#b7a9bc] mt-0.5">
              Permanently delete your account, API keys, tracked lists, and notification history. This action cannot be undone.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeletePassword("");
              setDeleteError(null);
            }}
            className="btn-danger px-4 py-2 rounded-xl bg-[#ff8a80]/20 hover:bg-[#ff8a80] text-[#ff8a80] hover:text-cream text-xs font-bold transition-all ios-press"
          >
            Delete Account Permanently
          </button>
        </div>
      </section>

      {/* Key Input Modal */}
      {editingKeyType && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/ backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#160e19] border border-plum-line p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#4fd27f]/20 text-[#4fd27f]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-cream">
                  {keys?.[editingKeyType].configured ? "Replace" : "Connect"}{" "}
                  {editingKeyType.toUpperCase()} Key
                </h3>
                <p className="text-xs text-[#b7a9bc] mt-0.5">
                  Encrypted at rest with AES-256-GCM.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="key-input" className="text-xs font-semibold text-cream">
                  API Key
                </label>
                <input
                  id="key-input"
                  type="password"
                  required
                  placeholder={`Paste your ${editingKeyType.toUpperCase()} key...`}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#2c1b33] border border-plum-line text-cream placeholder:text-dim text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>

              {keyError && <p className="text-xs text-[#ff8a80] font-medium">{keyError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKeyType(null)}
                  className="px-4 py-2 rounded-xl text-xs text-[#b7a9bc] hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingKey || !inputKey.trim()}
                  className="btn-primary px-5 py-2 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save & Encrypt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/ backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#160e19] border border-[#ff8a80]/30 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#ff8a80]/20 text-[#ff8a80]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-cream">Delete Account</h3>
                <p className="text-xs text-[#b7a9bc] mt-0.5">
                  Confirm your password to permanently delete all your data.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="del-pw" className="text-xs font-semibold text-cream">
                  Current Password
                </label>
                <input
                  id="del-pw"
                  type="password"
                  required
                  placeholder="Enter your current password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#2c1b33] border border-plum-line text-cream placeholder:text-dim text-sm focus:outline-none focus:border-[#ff8a80] transition-all"
                />
              </div>

              {deleteError && (
                <p className="text-xs text-[#ff8a80] font-medium">{deleteError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#b7a9bc] hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || !deletePassword}
                  className="px-5 py-2 rounded-xl bg-[#ff8a80] hover:bg-[#ff8a80] text-ink text-xs font-bold transition-all ios-press disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDeletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
