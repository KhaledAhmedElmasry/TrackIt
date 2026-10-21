import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionContext } from "@/lib/auth/session";
import { NotificationService } from "@/lib/services/notification.service";
import { z } from "zod";
import { UnauthorizedError, handleApiError } from "@/lib/errors/app-error";

/**
 * GET /api/notifications
 * Retrieves user's in-app notifications and unread count.
 * With ?countOnly=1 only the unread count is returned (used by the header badge).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      return NextResponse.json({
        success: true,
        data: { notifications: [], unreadCount: 0 },
      });
    }

    if (req.nextUrl.searchParams.get("countOnly") === "1") {
      const unreadCount = await NotificationService.getUnreadCount(session.user.id);
      return NextResponse.json({ success: true, data: { unreadCount } });
    }

    const result = await NotificationService.getUserNotifications(session.user.id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch notifications";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Marks a specific notification or all notifications as read.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = await req.json().catch(() => ({}));
    const notificationId = body.id as string | undefined;
    if (notificationId !== undefined && (typeof notificationId !== "string" || !ObjectId.isValid(notificationId))) {
      return NextResponse.json({ success: false, error: "Invalid notification id" }, { status: 400 });
    }

    await NotificationService.markAsRead(session.user.id, notificationId);

    return NextResponse.json({
      success: true,
      message: notificationId ? "Notification marked as read" : "All notifications marked as read",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notification";
    const status = error instanceof UnauthorizedError ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

const DeleteNotificationsSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({
    ids: z
      .array(z.string().refine((id) => ObjectId.isValid(id), "Invalid notification id"))
      .min(1)
      .max(500),
  }),
]);

/**
 * DELETE /api/notifications
 * Body: { ids: string[] } to delete specific notifications, or { all: true } to clear them all.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) {
      throw new UnauthorizedError("Authentication required");
    }

    const body = DeleteNotificationsSchema.parse(await req.json().catch(() => ({})));
    const deletedCount = await NotificationService.deleteNotifications(
      session.user.id,
      "ids" in body ? body.ids : undefined
    );

    return NextResponse.json({ success: true, data: { deletedCount } });
  } catch (error) {
    return handleApiError(error);
  }
}
