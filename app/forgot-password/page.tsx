"use client";

/**
 * Forgot Password Request Page
 *
 * Implements anti-user-enumeration password reset requests.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, Send, CheckCircle2, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      setIsSubmitted(true);
      setMessage(
        json.message ||
          "If a verified account with that email address exists, reset instructions have been sent."
      );
    } catch {
      setIsSubmitted(true);
      setMessage(
        "If a verified account with that email address exists, reset instructions have been sent."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display font-black text-5xl leading-[0.9]">
            Reset Password
          </h1>
          <p className="text-xs text-[#b7a9bc]">
            Enter your email to receive a secure, 30-minute password reset link.
          </p>
        </div>

        <div className="ios-card p-6 md:p-8 space-y-5">
          {isSubmitted ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-12 h-12 rounded-full bg-[#4fd27f]/20 text-[#4fd27f] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-cream">Instructions Dispatched</h2>
                <p className="text-xs text-[#b7a9bc] mt-1 max-w-xs mx-auto leading-relaxed">
                  {message}
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#4fd27f] hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-email" className="text-xs font-semibold text-cream">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-[rgba(255,255,255,0.08)] text-cream placeholder-[#b7a9bc] text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full py-3 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center justify-center gap-2 shadow-lg shadow-[#4fd27f]/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Guaranteed Recovery Code Alternative */}
          <div className="pt-4 border-t border-[rgba(255,255,255,0.06)]">
            <Link
              href="/reset-password?mode=recovery"
              className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center gap-3 group hover:border-[#e9b44c]/30 transition-colors"
            >
              <div className="p-2 rounded-lg bg-[#e9b44c]/20 text-[#e9b44c]">
                <KeyRound className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-cream group-hover:text-[#e9b44c] transition-colors">
                  Have a backup recovery code?
                </p>
                <p className="text-[11px] text-[#b7a9bc]">
                  Reset password instantly without waiting for an email.
                </p>
              </div>
            </Link>
          </div>
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

