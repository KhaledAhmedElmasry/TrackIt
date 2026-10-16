"use client";

/**
 * Unverified Email Alert Banner
 *
 * Appears when an authenticated user has not yet verified their email address.
 * Allows immediate app use while providing a rate-limited "Resend Email" button.
 */

import React, { useState } from "react";
import { Mail, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "./auth-context";

export function UnverifiedBanner() {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!user || user.isVerified) {
    return null;
  }

  const handleResend = async () => {
    setIsSending(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const json = await res.json();

      if (res.ok && json.success) {
        setIsSuccess(true);
        setStatusMessage("Verification link sent! Please check your inbox or spam.");
      } else {
        setIsSuccess(false);
        setStatusMessage(json.error?.message || "Failed to resend verification email.");
      }
    } catch {
      setIsSuccess(false);
      setStatusMessage("Network error. Please try again later.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-6 p-4 rounded-2xl bg-[#2a1b0a]/90 border border-[#f59e0b]/40 backdrop-blur-xl animate-in fade-in"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-[#f59e0b]/20 text-[#fbbf24] shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#fef3c7] uppercase tracking-wider">
              Verify Your Email Address
            </h3>
            <p className="text-xs text-[#fde68a]/90 mt-0.5">
              Unverified accounts are automatically deleted after 7 days. Password resets require a verified email.
            </p>
            {statusMessage && (
              <p
                className={`text-[11px] font-semibold mt-1.5 ${
                  isSuccess ? "text-[#34d399]" : "text-[#f87171]"
                }`}
              >
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleResend}
          disabled={isSending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-black text-xs font-bold transition-all ios-press shrink-0 disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSuccess ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Mail className="w-3.5 h-3.5" />
          )}
          <span>{isSending ? "Sending..." : isSuccess ? "Sent" : "Resend Link"}</span>
        </button>
      </div>
    </div>
  );
}

