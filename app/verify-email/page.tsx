"use client";

/**
 * Email Verification Confirmation Page
 *
 * Verifies the 30-minute token provided in the URL query parameters.
 */

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { refreshUser } = useAuth();

  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState<string>(
    token ? "Verifying your email address..." : "No verification token found in URL."
  );

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        setIsLoading(false);
        if (json.success) {
          setIsSuccess(true);
          setMessage("Your email address has been verified successfully!");
          refreshUser();
        } else {
          setIsSuccess(false);
          setMessage(json.error?.message || "Invalid or expired verification link.");
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoading(false);
          setIsSuccess(false);
          setMessage("Network error occurred during verification.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [token, refreshUser]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md ios-card p-8 text-center space-y-6">
        {isLoading ? (
          <div className="space-y-4 py-8">
            <Loader2 className="w-12 h-12 text-[#0a84ff] animate-spin mx-auto" />
            <h2 className="text-base font-bold text-white">Verifying Account...</h2>
            <p className="text-xs text-[#8e8e93]">{message}</p>
          </div>
        ) : isSuccess ? (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-[#32d74b]/20 text-[#32d74b] flex items-center justify-center mx-auto shadow-lg shadow-[#32d74b]/15">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Email Verified!</h2>
              <p className="text-xs text-[#8e8e93] mt-1 max-w-xs mx-auto">{message}</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0a84ff] hover:bg-[#0071e3] text-white text-xs font-bold transition-all ios-press mt-2 shadow-lg shadow-[#0a84ff]/20"
            >
              <span>Go to WatchTrack</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-[#ff453a]/20 text-[#ff453a] flex items-center justify-center mx-auto shadow-lg shadow-[#ff453a]/15">
              <XCircle className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Verification Failed</h2>
              <p className="text-xs text-[#ff453a] mt-1 max-w-xs mx-auto">{message}</p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] text-white text-xs font-semibold transition-all ios-press"
              >
                <span>Back to Sign In</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

