import { cn } from "@/lib/utils/cn";

/**
 * TrackIt wordmark: a film-frame mark with a play notch and the condensed poster logotype.
 */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const markSize = { sm: 24, md: 30, lg: 40 }[size];
  const textSize = { sm: "text-[26px]", md: "text-[34px]", lg: "text-5xl" }[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width={markSize} height={markSize} viewBox="0 0 30 30" aria-hidden="true">
        <rect x="2" y="5" width="26" height="20" rx="3" fill="none" stroke="var(--green)" strokeWidth="2.5" />
        <path d="M2 11h26M2 19h26" stroke="var(--green)" strokeWidth="2.5" />
        <path d="M12 13l6 2-6 2z" fill="var(--green)" />
      </svg>
      <span className={cn("font-display font-black leading-none text-cream", textSize)}>
        Track<span className="text-green">It</span>
      </span>
    </span>
  );
}
