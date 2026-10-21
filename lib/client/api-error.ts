/**
 * Extracts a human-readable message from an API error response.
 *
 * Routes answer with either `{ error: "text" }` or `{ error: { code, message } }`
 * (see handleApiError); this reads both so forms never show "[object Object]".
 */
export function apiErrorMessage(json: unknown, fallback: string): string {
  const error = (json as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
