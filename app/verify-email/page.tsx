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
            <Loader2 className="w-12 h-12 text-[#4fd27f] animate-spin mx-auto" />
            <h2 className="text-base font-bold text-cream">Verifying Account...</h2>
            <p className="text-xs text-[#b7a9bc]">{message}</p>
          </div>
        ) : isSuccess ? (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-[#4fd27f]/20 text-[#4fd27f] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-cream">Email Verified!</h2>
              <p className="text-xs text-[#b7a9bc] mt-1 max-w-xs mx-auto">{message}</p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press mt-2"
            >
              <span>Go to TrackIt</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-[#ff8a80]/20 text-[#ff8a80] flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-cream">Verification Failed</h2>
              <p className="text-xs text-[#ff8a80] mt-1 max-w-xs mx-auto">{message}</p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-plum-line hover:bg-plum-line text-cream text-xs font-semibold transition-all ios-press"
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
          <Loader2 className="w-8 h-8 text-[#4fd27f] animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

