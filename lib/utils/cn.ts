/**
 * Lightweight class name helper for conditional CSS classes.
 */
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

