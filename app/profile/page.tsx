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
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

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
    anchor.download = "watchtrack-export.json";
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
        <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ios-card p-10 text-center space-y-4 max-w-md mx-auto my-12 animate-in fade-in">
        <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] text-[#8e8e93] flex items-center justify-center mx-auto">
          <Key className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Sign In Required</h2>
          <p className="text-xs text-[#8e8e93] mt-1">
            Please sign in or create an account to configure your private keys and tracker settings.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-[#0a84ff] text-white text-xs font-bold ios-press"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 rounded-xl bg-[rgba(255,255,255,0.08)] text-white text-xs font-semibold ios-press"
          >
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            Settings & Account
          </h1>
          <p className="text-xs md:text-sm text-[#8e8e93] mt-0.5">
            Manage your credentials, AES-256-GCM encrypted keys, and notification channels.
          </p>
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[#ff453a]/20 hover:text-[#ff453a] text-xs font-semibold text-white transition-colors ios-press shrink-0"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Account Info Card */}
      <div className="ios-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-[#8e8e93]">Signed in as</p>
            <p className="text-sm font-bold text-white">{user.email}</p>
          </div>
          <div>
            {user.isVerified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#32d74b]/15 text-[#32d74b] text-[11px] font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ffd60a]/15 text-[#ffd60a] text-[11px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Unverified</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* API Keys Management */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#0a84ff]" />
            <h2 className="text-base font-bold text-white">Encrypted API Keys</h2>
          </div>
          <span className="text-[11px] text-[#32d74b] font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AES-256-GCM</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TMDB Key Card */}
          <div className="ios-card p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  TMDB API Key
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    keys?.tmdb.configured
                      ? "bg-[#32d74b]/15 text-[#32d74b]"
                      : "bg-[#ff453a]/15 text-[#ff453a]"
                  }`}
                >
                  {keys?.tmdb.configured ? "Connected" : "Required"}
                </span>
              </div>
              <p className="text-xs text-[#8e8e93]">
                Required for movie/series metadata, search, and episode tracking.
              </p>

              {keys?.tmdb.configured && (
                <div className="p-2.5 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.06)] font-mono text-xs text-white flex items-center justify-between">
                  <span>••••••••••••{keys.tmdb.lastFour}</span>
                  <span className="text-[10px] text-[#8e8e93] font-sans">Encrypted at rest</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKeyType("tmdb");
                    setInputKey("");
                    setKeyError(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold transition-all ios-press flex items-center justify-center gap-1.5"
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
                    className="p-2 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[#ff453a]/20 text-[#8e8e93] hover:text-[#ff453a] transition-colors ios-press"
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
                className="inline-flex items-center gap-1.5 text-[11px] text-[#8e8e93] hover:text-[#0a84ff] transition-colors"
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
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#bf5af2]" />
                  <span>Google Gemini Key</span>
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    keys?.gemini.configured
                      ? "bg-[#32d74b]/15 text-[#32d74b]"
                      : "bg-[rgba(255,255,255,0.08)] text-[#8e8e93]"
                  }`}
                >
                  {keys?.gemini.configured ? "Connected" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-[#8e8e93]">
                Optional until you request AI watch recommendations in Phase 5.
              </p>

              {keys?.gemini.configured && (
                <div className="p-2.5 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.06)] font-mono text-xs text-white flex items-center justify-between">
                  <span>••••••••••••{keys.gemini.lastFour}</span>
                  <span className="text-[10px] text-[#8e8e93] font-sans">Encrypted at rest</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingKeyType("gemini");
                    setInputKey("");
                    setKeyError(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-[#bf5af2] hover:bg-[#a332d9] text-white text-xs font-bold transition-all ios-press flex items-center justify-center gap-1.5"
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
                    className="p-2 rounded-xl bg-[rgba(255,255,255,0.06)] hover:bg-[#ff453a]/20 text-[#8e8e93] hover:text-[#ff453a] transition-colors ios-press"
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
                className="inline-flex items-center gap-1.5 text-[11px] text-[#8e8e93] hover:text-[#bf5af2] transition-colors"
              >
                <span>Get a free API key at Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Push Notifications Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#ffd60a]" />
          <h2 className="text-base font-bold text-white">Push Notifications (ntfy.sh)</h2>
        </div>

        <div className="ios-card p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-white">Your Private Notification Topic</p>
            <p className="text-xs text-[#8e8e93] mt-0.5">
              Each user receives a unique, long random topic. Subscribe to this topic in the free <strong>ntfy</strong> app (iOS / Android / Web) to get alerts for new aired episodes.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-[#ffd60a] truncate select-all">
              {user.ntfyTopic}
            </span>
            <button
              type="button"
              onClick={handleCopyTopic}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-white text-xs font-semibold transition-all ios-press shrink-0"
            >
              {copiedTopic ? <Check className="w-3.5 h-3.5 text-[#32d74b]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTopic ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
            <a
              href={`https://ntfy.sh/${user.ntfyTopic}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0a84ff] hover:underline"
            >
              <span>Open topic on ntfy.sh</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ffd60a]/15 hover:bg-[#ffd60a]/25 border border-[#ffd60a]/30 text-[#ffd60a] text-xs font-bold transition-all ios-press disabled:opacity-50"
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
            <p className="text-[11px] text-[#32d74b] font-semibold pt-1">
              {testPushFeedback}
            </p>
          )}
        </div>
      </section>

      {/* Security & Recovery Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#32d74b]" />
          <h2 className="text-base font-bold text-white">Account Recovery</h2>
        </div>

        <div className="ios-card p-5 space-y-2">
          <p className="text-xs text-white font-semibold">One-Time Backup Recovery Codes</p>
          <p className="text-xs text-[#8e8e93] leading-relaxed">
            Your 10 one-time recovery codes generated at signup remain active until used. They allow you to reset your password instantly at any time, even if you cannot access your email.
          </p>
        </div>
      </section>

      {/* Data Management Section (Phase 6) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-5 h-5 text-[#0a84ff]" />
          <h2 className="text-base font-bold text-white">Data Management</h2>
        </div>

        <div className="ios-card p-5 space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-white">Export & Import Your Watchlist</h3>
            <p className="text-xs text-[#8e8e93] mt-0.5 leading-relaxed">
              Your library belongs to you. Export your entire tracked watchlist, ratings, and episode progress as an offline JSON backup, or import to restore or migrate data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportData}
              className="px-4 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold transition-all ios-press flex items-center gap-2 shadow-md shadow-[#0a84ff]/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Library (JSON)</span>
            </button>

            {/* Import Button */}
            <label className="px-4 py-2 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-white text-xs font-bold transition-all ios-press flex items-center gap-2 cursor-pointer border border-white/10">
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0a84ff]" />
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
            <div className="p-3 rounded-xl bg-[#32d74b]/15 border border-[#32d74b]/30 text-xs text-[#32d74b] font-semibold">
              {importStatus}
            </div>
          )}

          {importError && (
            <div className="p-3 rounded-xl bg-[#ff453a]/15 border border-[#ff453a]/30 text-xs text-[#ff453a] font-semibold">
              {importError}
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone: Account Deletion */}
      <section className="space-y-3 pt-4 border-t border-[rgba(255,255,255,0.08)]">
        <div className="p-5 rounded-2xl bg-[#2a0e0e]/50 border border-[#ff453a]/25 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-[#ff453a]">Danger Zone</h3>
            <p className="text-xs text-[#8e8e93] mt-0.5">
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
            className="px-4 py-2 rounded-xl bg-[#ff453a]/20 hover:bg-[#ff453a] text-[#ff453a] hover:text-white text-xs font-bold transition-all ios-press"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#161619] border border-[rgba(255,255,255,0.12)] p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#0a84ff]/20 text-[#0a84ff]">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">
                  {keys?.[editingKeyType].configured ? "Replace" : "Connect"}{" "}
                  {editingKeyType.toUpperCase()} Key
                </h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  Encrypted at rest with AES-256-GCM.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="key-input" className="text-xs font-semibold text-white">
                  API Key
                </label>
                <input
                  id="key-input"
                  type="password"
                  required
                  placeholder={`Paste your ${editingKeyType.toUpperCase()} key...`}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#8e8e93] text-sm focus:outline-none focus:border-[#0a84ff] transition-all"
                />
              </div>

              {keyError && <p className="text-xs text-[#ff453a] font-medium">{keyError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKeyType(null)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8e8e93] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingKey || !inputKey.trim()}
                  className="px-5 py-2 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold transition-all ios-press disabled:opacity-50 flex items-center gap-1.5"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#161619] border border-[#ff453a]/30 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#ff453a]/20 text-[#ff453a]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Delete Account</h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">
                  Confirm your password to permanently delete all your data.
                </p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="del-pw" className="text-xs font-semibold text-white">
                  Current Password
                </label>
                <input
                  id="del-pw"
                  type="password"
                  required
                  placeholder="Enter your current password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.08)] text-white placeholder-[#8e8e93] text-sm focus:outline-none focus:border-[#ff453a] transition-all"
                />
              </div>

              {deleteError && (
                <p className="text-xs text-[#ff453a] font-medium">{deleteError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#8e8e93] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || !deletePassword}
                  className="px-5 py-2 rounded-xl bg-[#ff453a] hover:bg-[#d9382f] text-white text-xs font-bold transition-all ios-press disabled:opacity-50 flex items-center gap-1.5"
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
