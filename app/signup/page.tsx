"use client";

/**
 * Account Registration Page
 *
 * Implements:
 * - User signup with password requirements.
 * - Interactive Modal presenting 10 one-time recovery backup codes.
 * - One-tap code copying and mandatory user confirmation before proceeding.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  Loader2,
  ShieldAlert,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recovery Codes Modal State
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          username: username.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || "Failed to create account. Please try again.");
        return;
      }

      // Present recovery codes modal to user
      setRecoveryCodes(json.data.recoveryCodes);
      await refreshUser();
    } catch {
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCodes = () => {
    if (!recoveryCodes) return;
    const textToCopy = [
      "TRACKIT RECOVERY BACKUP CODES",
      "Keep these codes in a secure password manager or offline safe.",
      "Each code is valid once to reset your password if email is unavailable.",
      "",
      ...recoveryCodes.map((code, idx) => `${idx + 1}. ${code}`),
    ].join("\n");

    navigator.clipboard.writeText(textToCopy);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  const handleFinishSignup = () => {
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Logo size="lg" className="justify-center mb-4" />
          <h1 className="font-display font-black text-5xl leading-[0.9]">
            Create Your Account
          </h1>
          <p className="text-xs text-[#b7a9bc]">
            Free, private, and fully encrypted movie & series tracker
          </p>
        </div>

        {/* Signup Form Card */}
        <div className="ios-card p-6 md:p-8 space-y-5">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#ff8a80]/15 border border-[#ff8a80]/30 text-[#ff8a80] text-xs font-medium"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="signup-username" className="text-xs font-semibold text-cream flex items-center justify-between">
                <span>Display Username</span>
                <span className="text-[10px] text-[#b7a9bc] font-normal">Optional</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-username"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. Alex"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={2}
                  maxLength={30}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="text-xs font-semibold text-cream">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="text-xs font-semibold text-cream">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters with letter & number"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>
              <p className="text-[11px] text-[#b7a9bc] pl-1">
                Minimum 8 characters with at least one letter and one number.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || password.length < 8}
              className="w-full py-3 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center justify-center gap-2 shadow-lg shadow-[#4fd27f]/20 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Account & Get Backup Codes</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy Note */}
          <div className="pt-2 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-center gap-2 text-[11px] text-[#b7a9bc]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4fd27f]" />
            <span>Fully private. No social sharing. No tracking.</span>
          </div>
        </div>

        {/* Existing account footer */}
        <div className="text-center text-xs text-[#b7a9bc]">
          Already have an account?{" "}
          <Link href="/login" className="text-[#4fd27f] font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>

      {/* Recovery Codes Presentation Modal */}
      {recoveryCodes && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#160e19] border border-[rgba(255,255,255,0.12)] p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-[#e9b44c]/20 text-[#e9b44c] shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#e9b44c]">
                  Guaranteed Account Backup
                </span>
                <h2 className="text-xl font-extrabold text-cream tracking-tight">
                  Save Your Recovery Codes
                </h2>
                <p className="text-xs text-[#b7a9bc] mt-1 leading-relaxed">
                  These 10 one-time recovery codes are your <strong>guaranteed fallback</strong> to reset your password if you ever lose access to your email. Each code can only be used once.
                </p>
              </div>
            </div>

            {/* Codes Grid */}
            <div className="p-4 rounded-2xl bg-[#0d0d0f] border border-[rgba(255,255,255,0.08)]">
              <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs text-[#f2ece4] tracking-wider select-text">
                {recoveryCodes.map((code, idx) => (
                  <div
                    key={code}
                    className="p-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.04)]"
                  >
                    <span className="text-[#b7a9bc] text-[10px] mr-1.5">{idx + 1}.</span>
                    <span className="font-semibold text-cream">{code}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleCopyCodes}
                className="w-full py-2.5 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] text-cream text-xs font-semibold flex items-center justify-center gap-2 transition-all ios-press"
              >
                {copiedCodes ? (
                  <>
                    <Check className="w-4 h-4 text-[#4fd27f]" />
                    <span className="text-[#4fd27f]">All 10 Codes Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All Recovery Codes</span>
                  </>
                )}
              </button>

              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={hasConfirmedSaved}
                  onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-[#4fd27f] focus:ring-0"
                />
                <span className="text-xs text-[#b7a9bc] leading-snug">
                  I have copied or written down these backup recovery codes and understand they will not be shown again.
                </span>
              </label>

              <button
                type="button"
                onClick={handleFinishSignup}
                disabled={!hasConfirmedSaved}
                className="w-full py-3 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#4fd27f]/20"
              >
                Continue to TrackIt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

