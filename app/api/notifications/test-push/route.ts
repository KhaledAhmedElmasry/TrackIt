import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongodb";
import { NotificationService } from "@/lib/services/notification.service";
import { UnauthorizedError } from "@/lib/errors/app-error";
import { UserDocument } from "@/lib/models/types";
import { getAppUrl } from "@/lib/utils/app-url";

/**
 * POST /api/notifications/test-push
 * Sends an immediate test push notification to the user's private ntfy.sh topic or Bark key.
 */
export async function POST() {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const db = await getDb();
    const user = await db.collection<UserDocument>("users").findOne({
      _id: new ObjectId(session.user.id),
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const topic = user.ntfyTopic;
    const barkKey = user.barkKey;

    if (!topic && !barkKey) {
      return NextResponse.json(
        { success: false, error: "No ntfy topic or Bark key configured" },
        { status: 400 }
      );
    }

    const res = await NotificationService.sendPush({
      topic,
      barkKey,
      title: "TrackIt Test Push",
      message: "Push notifications are working perfectly! You'll receive alerts for newly aired episodes.",
      clickUrl: getAppUrl(),
    });

    if (!res.ntfySent && !res.barkSent) {
      return NextResponse.json(
        { success: false, error: "Push dispatch failed. Check your topic or network." },
        { status: 502 }
      );
    }

    // Also create in-app notification
    await NotificationService.createInAppNotification({
      userId: session.user.id,
      title: "Test Notification",
      message: "Push notification setup verified successfully.",
      type: "system",
    });

    return NextResponse.json({
      success: true,
      message: "Test push notification sent successfully!",
      data: res,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch test notification";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
