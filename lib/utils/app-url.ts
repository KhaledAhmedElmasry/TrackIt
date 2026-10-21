/**
 * Public base URL of the deployed app, used for links in emails and push notifications.
 *
 * Resolution order:
 * 1. APP_URL (set explicitly in Vercel project settings)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (injected automatically by Vercel, no protocol)
 * 3. The known production domain in production, localhost otherwise
 */

const PRODUCTION_URL = "https://track-it-chi-rose.vercel.app";

export function getAppUrl(): string {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url =
    process.env.APP_URL ||
    (vercelHost ? `https://${vercelHost}` : null) ||
    (process.env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3000");

  return url.replace(/\/+$/, "");
}
