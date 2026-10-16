/**
 * Recommendations Page Shell (Phase 1 preview, ready for Phase 5 integration)
 */

import { Sparkles, Brain, ShieldCheck } from "lucide-react";

export default function RecommendationsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
          AI Recommendations
        </h1>
        <p className="text-sm text-[#8e8e93] mt-0.5">
          Private suggestions generated with Google Gemini and verified against TMDB.
        </p>
      </div>

      <div className="ios-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#bf5af2]/15 text-[#bf5af2] border border-[#bf5af2]/30 flex items-center justify-center mx-auto shadow-lg shadow-[#bf5af2]/10">
          <Brain className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white">Gemini Integration Architecture</h2>
          <p className="text-xs text-[#8e8e93] max-w-md mx-auto leading-relaxed">
            Recommendations only run on-demand when you tap &quot;Get recommendations&quot;. Zero personal data is sent, and all suggested IDs are strictly validated with TMDB to eliminate hallucinations.
          </p>
        </div>

        <div className="pt-2">
          <button
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#bf5af2] text-white text-xs font-bold opacity-60 cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>Get Recommendations (Phase 5)</span>
          </button>
        </div>

        <div className="inline-flex items-center gap-2 text-[11px] text-[#8e8e93]">
          <ShieldCheck className="w-4 h-4 text-[#32d74b]" />
          <span>User Gemini keys encrypted with AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
}

