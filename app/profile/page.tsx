/**
 * Profile & Settings Page Shell (Phase 1 preview, ready for Phase 2 integration)
 */

import { Key, Shield, Bell } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          Settings & Keys
        </h1>
        <p className="text-sm text-[#8e8e93] mt-0.5">
          Manage your credentials, encrypted API keys, and notification topics.
        </p>
      </div>

      <div className="space-y-4">
        {/* Encrypted Keys Section Preview */}
        <div className="ios-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <Key className="w-5 h-5 text-[#0a84ff]" />
            <div>
              <h2 className="text-sm font-bold text-white">User-Supplied API Keys</h2>
              <p className="text-[11px] text-[#8e8e93]">
                Encrypted at rest with AES-256-GCM using unique random IVs.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">TMDB API Key</p>
                <p className="text-[11px] text-[#8e8e93]">Required for movie and series metadata</p>
              </div>
              <span className="text-xs font-semibold text-[#8e8e93]">Phase 2 Setup</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Google Gemini API Key</p>
                <p className="text-[11px] text-[#8e8e93]">Optional until using AI recommendations</p>
              </div>
              <span className="text-xs font-semibold text-[#8e8e93]">Phase 2 Setup</span>
            </div>
          </div>
        </div>

        {/* Push Notification Config */}
        <div className="ios-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <Bell className="w-5 h-5 text-[#ffd60a]" />
            <div>
              <h2 className="text-sm font-bold text-white">Push Notifications</h2>
              <p className="text-[11px] text-[#8e8e93]">
                Zero-cost ntfy.sh private random topic or Bark key.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#8e8e93]">
            Configured automatically upon account creation with a long random unguessable topic.
          </p>
        </div>

        {/* Security & Backup */}
        <div className="ios-card p-5 space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <Shield className="w-5 h-5 text-[#32d74b]" />
            <div>
              <h2 className="text-sm font-bold text-white">Security & Recovery</h2>
              <p className="text-[11px] text-[#8e8e93]">
                8-10 one-time recovery backup codes generated at signup.
              </p>
            </div>
          </div>
          <p className="text-xs text-[#8e8e93]">
            Revocable server-side sessions with secure httpOnly SameSite cookies.
          </p>
        </div>
      </div>
    </div>
  );
}
