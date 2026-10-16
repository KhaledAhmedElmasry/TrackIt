"use client";

/**
 * First-Run Setup Modal
 *
 * Guides new users to enter their free TMDB API key upon initial login:
 * - Direct external links to get a free key at themoviedb.org
 * - Explains AES-256-GCM authenticated encryption at rest
 * - Instantly saves and refreshes user session state
 */

import React, { useState } from "react";
import { Key, ShieldCheck, ExternalLink, Loader2, Check } from "lucide-react";
import { useAuth } from "./auth-context";

export function FirstRunSetupModal() {
  const { user, refreshUser } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Show only if authenticated and TMDB key is not yet configured
  if (!user || user.hasTmdbKey || !isOpen) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyType: "tmdb", key: apiKey.trim() }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setIsSuccess(true);
        await refreshUser();
        setTimeout(() => setIsOpen(false), 1200);
      } else {
        setError(json.error?.message || "Failed to save key");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="w-full max-w-lg rounded-3xl bg-[#161619] border border-[rgba(255,255,255,0.12)] p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-[#0a84ff]/20 text-[#0a84ff] shrink-0">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0a84ff]">
              First-Run Setup
            </span>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Connect Your Free TMDB Key
            </h2>
            <p className="text-xs text-[#8e8e93] mt-1">
              WatchTrack uses your personal TMDB developer key to fetch movie and series details.
            </p>
          </div>
        </div>

        {/* Free Tier Guarantee Callout */}
        <div className="p-3.5 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#32d74b]">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-Cost & AES-256-GCM Encrypted</span>
          </div>
          <p className="text-[11px] text-[#8e8e93] leading-relaxed">
            TMDB API keys are 100% free with no credit card required. Your key is encrypted at rest using AES-256-GCM and never leaves the server in plaintext.
          </p>
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0a84ff] hover:underline pt-1"
          >
            <span>Get your free TMDB API key</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="tmdb-key" className="text-xs font-semibold text-white">
              TMDB API Key (v3 auth or v4 token)
            </label>
            <input
              id="tmdb-key"
              type="password"
              placeholder="Paste your TMDB key here..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading || isSuccess}
              required
              className="w-full px-4 py-3 rounded-xl bg-[#222226] border border-[rgba(255,255,255,0.1)] text-white placeholder-[#8e8e93] text-sm focus:outline-none focus:border-[#0a84ff] transition-all disabled:opacity-50"
            />
          </div>

          {error && <p className="text-xs text-[#ff453a] font-medium">{error}</p>}
          {isSuccess && (
            <div className="flex items-center gap-2 text-xs text-[#32d74b] font-semibold">
              <Check className="w-4 h-4" />
              <span>Key successfully encrypted and connected!</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#8e8e93] hover:text-white transition-colors"
            >
              Skip for now
            </button>

            <button
              type="submit"
              disabled={isLoading || !apiKey.trim() || isSuccess}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold transition-all ios-press disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Key className="w-4 h-4" />
              )}
              <span>{isLoading ? "Encrypting..." : "Save & Encrypt"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

