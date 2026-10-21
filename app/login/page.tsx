"use client";

/**
 * Sign In Page
 *
 * Implements Apple iOS dark authentication form:
 * - Email and password input with accessible labels.
 * - Handles rate limit lockouts with clear countdown messages.
 * - Links to account registration, email reset, and recovery code backup reset.
 */

import React, { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error?.message || "Invalid credentials. Please try again.");
        return;
      }

      await refreshUser();
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Logo size="lg" className="justify-center mb-4" />
          <h1 className="font-display font-black text-5xl leading-[0.9]">
            Sign In to TrackIt
          </h1>
          <p className="text-xs text-[#b7a9bc]">
            Your private, encrypted entertainment tracker
          </p>
        </div>

        {/* Form Card */}
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
              <label htmlFor="login-email" className="text-xs font-semibold text-cream">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-plum-line text-cream placeholder:text-dim text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-cream">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-[#4fd27f] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b7a9bc]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#2c1b33] border border-plum-line text-cream placeholder:text-dim text-sm focus:outline-none focus:border-[#4fd27f] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 rounded-xl bg-[#4fd27f] hover:bg-[#3fbf6d] text-ink text-xs font-bold transition-all ios-press flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy callout */}
          <div className="pt-2 border-t border-plum-line flex items-center justify-center gap-2 text-[11px] text-[#b7a9bc]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4fd27f]" />
            <span>Encrypted server-side sessions & scrypt hashes</span>
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center space-y-2 text-xs">
          <p className="text-[#b7a9bc]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#4fd27f] font-semibold hover:underline">
              Create Account
            </Link>
          </p>
          <p>
            <Link
              href="/reset-password?mode=recovery"
              className="text-[#b7a9bc] hover:text-cream transition-colors"
            >
              Locked out? Reset using a one-time recovery code
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

