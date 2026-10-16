import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongodb";
import { handleApiError, AuthenticationError } from "@/lib/errors/app-error";

const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 characters long")
    .max(30, "Username must not exceed 30 characters")
    .regex(/^[a-zA-Z0-9_\- ]+$/, "Username can only contain letters, numbers, spaces, underscores, and dashes"),
});

/**
 * POST /api/user/username
 * Updates the user's display username.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    const body = await req.json();
    const validated = UpdateUsernameSchema.parse(body);

    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          username: validated.username,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: "Username updated successfully",
      data: { username: validated.username },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
