import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongodb";
import { handleApiError, AuthenticationError } from "@/lib/errors/app-error";

const SaveBarkKeySchema = z.object({
  barkKey: z.string().trim().min(1, "Bark key cannot be empty").max(200, "Bark key too long"),
});

/**
 * POST /api/user/bark
 * Saves or updates the user's Bark push notification key.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const body = await req.json();
    const validated = SaveBarkKeySchema.parse(body);

    let cleanKey = validated.barkKey.trim();
    // Strip URL prefix if pasted as a full URL
    cleanKey = cleanKey.replace(/^https?:\/\/api\.day\.app\//, "").replace(/^\/+|\/+$/g, "");

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          barkKey: cleanKey,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Bark push key saved successfully",
      data: { barkKey: cleanKey },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/user/bark
 * Removes the user's Bark push notification key.
 */
export async function DELETE() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $unset: { barkKey: "" },
        $set: { updatedAt: new Date() },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Bark push key removed successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
