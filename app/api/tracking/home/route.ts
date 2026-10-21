import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { handleApiError, UnauthorizedError } from "@/lib/errors/app-error";

/**
 * GET /api/tracking/home
 * Home screen summary: in-progress series, upcoming episodes and list counts.
 */
export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const summary = await TrackingService.getHomeSummary(session.user.id);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    return handleApiError(error);
  }
}
