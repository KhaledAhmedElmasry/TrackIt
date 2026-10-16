import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { TrackingService } from "@/lib/services/tracking.service";
import { UnauthorizedError } from "@/lib/errors/app-error";

const OverrideSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  override: z.enum(["dropped", "on_hold"]).nullable(),
});

/**
 * POST /api/tracking/override
 * Sets a manual status override ("dropped" | "on_hold" | null).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json();
    const parsed = OverrideSchema.parse(body);

    await TrackingService.setOverride(
      session.user.id,
      parsed.tmdbId,
      parsed.mediaType,
      parsed.override
    );

    return NextResponse.json({
      success: true,
      message: parsed.override ? `Status override set to ${parsed.override}` : "Status override cleared",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update override";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
