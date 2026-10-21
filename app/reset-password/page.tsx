"use client";

/**
 * Reset Password Page
 *
 * Supports two authentication paths:
 * 1. Single-use 30-minute Email Token (/reset-password?token=...)
 * 2. Guaranteed 10 One-Time Recovery Codes (/reset-password?mode=recovery)
 */

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, KeyRound, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialToken = searchParams.get("token") || "";
  const initialMode = searchParams.get("mode") === "recovery" ? "recovery" : "token";

  const [mode, setMode] = useState<"token" | "recovery">(initialToken ? "token" : initialMode);
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let res: Response;

      if (mode === "token") {
        res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.trim(), newPassword }),
        });
      } else {
        res = await fetch("/api/auth/reset-with-recovery-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            recoveryCode: recoveryCode.trim(),
            newPassword,
          }),
        });
      }

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || "Failed to reset password.");
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display font-black text-5xl leading-[0.9]">
            Set New Password
          </h1>
          <p className="text-xs text-[#b7a9bc]">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        <div className="ios-card p-6 md:p-8 space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.06)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode("token");
                setErrorMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === "token"
                  ? "bg-[#4fd27f] text-ink shadow"
                  : "text-[#b7a9bc] hover:text-cream"
              }`}
            >
              Email Link Token
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("recovery");
                setErrorMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === "recovery"
                  ? "bg-[#4fd27f] text-ink shadow"
                  : "text-[#b7a9bc] hover:text-cream"
              }`}
            >
              Recovery Code
            </button>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[#ff8a80]/15 border border-[#ff8a80]/30 text-[#ff8a80] text-xs font-medium"
            >
              {errorMessage}
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 rounded-full bg-[#4fd27f]/20 text-[#4fd27f] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-sm font-bold text-cream">Password Updated!</h2>
              <p className="text-xs text-[#b7a9bc]">
                All other sessions have been revoked. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "token" ? (
                <div className="space-y-1.5">
                  <label htmlFor="reset-token" className="text-xs font-semibold text-cream">
                    Reset Token
                  </label>
                  <input
                    id="reset-token"
                    type="text"
                    required
                    placeholder="Paste reset token here..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream text-xs font-mono focus:outline-none focus:border-[#4fd27f] transition-all"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="rec-email" className="text-xs font-semibold text-cream">
                      Account Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="rec-email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="rec-code" className="text-xs font-semibold text-cream">
                      One-Time Recovery Code (XXXX-XXXX-XXXX)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        id="rec-code"
                        type="text"
                        required
                        placeholder="XXXX-XXXX-XXXX"
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm font-mono tracking-wider focus:outline-none focus:border-[#4fd27f] transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label htmlFor="new-pw" className="text-xs font-semibold text-cream">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-pw"
                    type="password"
                    required
                    placeholder="At least 8 characters with letter & number"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || newPassword.length < 8}
                className="w-full py-3 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center justify-center gap-2 shadow-lg shadow-[#4fd27f]/20 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Update Password & Revoke Sessions</span>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center text-xs text-[#b7a9bc]">
          <Link href="/login" className="hover:text-cream transition-colors inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#4fd27f] animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

