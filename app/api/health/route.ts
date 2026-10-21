/**
 * Health Check API Route Handler
 * GET /api/health
 *
 * Verifies application readiness, database connectivity, and environment status.
 * Safe to be used by Vercel deployment probes and uptime monitors.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongodb";
import { handleApiError } from "@/lib/errors/app-error";

export async function GET() {
  try {
    let dbStatus = "not_configured";
    let dbLatencyMs: number | null = null;

    if (process.env.MONGODB_URI) {
      try {
        const start = Date.now();
        const db = await getDb();
        await db.command({ ping: 1 });
        dbLatencyMs = Date.now() - start;
        dbStatus = "connected";
      } catch (dbErr) {
        dbStatus = "error";
        console.error("MongoDB health check ping failed:", dbErr);
      }
    }

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "TrackIt API",
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
