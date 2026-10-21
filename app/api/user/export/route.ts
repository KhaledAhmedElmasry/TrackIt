import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongodb";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { TrackedItemDocument, UserDocument } from "@/lib/models/types";

/**
 * GET /api/user/export
 * Exports user's entire library, watched episodes, and preferences as JSON.
 * Sensitive data (passwords, tokens, encrypted API keys) are strictly excluded.
 */
export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const db = await getDb();
    const userObjectId = new ObjectId(session.user.id);

    const [user, trackedItems] = await Promise.all([
      db.collection<UserDocument>("users").findOne({ _id: userObjectId }),
      db.collection<TrackedItemDocument>("tracked_items").find({ userId: userObjectId }).toArray(),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const sanitizedExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        createdAt: user.createdAt,
        ntfyTopic: user.ntfyTopic || null,
        barkKey: user.barkKey || null,
      },
      library: trackedItems.map((item) => ({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        status: item.status,
        override: item.override || null,
        rating: item.rating ?? null,
        notify: item.notify ?? false,
        minimalSnapshot: item.minimalSnapshot,
        watchedEpisodes: item.watchedEpisodes || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `trackit-export-${dateStr}.json`;

    return new NextResponse(JSON.stringify(sanitizedExport, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
