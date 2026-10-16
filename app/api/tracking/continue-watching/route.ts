import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

/**
 * GET /api/tracking/continue-watching
 * Returns the "Continue Watching" row: next unwatched episode per series in currently_watching.
 */
export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({
        success: true,
        data: { items: [] },
      });
    }

    const items = await TrackingService.getContinueWatchingRow(session.user.id);

    return NextResponse.json({
      success: true,
      data: { items },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch continue watching";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
