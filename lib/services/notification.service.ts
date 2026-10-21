/**
 * Push Notification & In-App Notification Service
 *
 * Implements:
 * - Free push via ntfy.sh (per-user long random topic, e.g. "trackit-usr-abcdef123456").
 * - Optional Bark push notification key.
 * - In-app notification creation and read/unread state management.
 * - Zero cost: uses public free servers (ntfy.sh / day.app).
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import { NotificationDocument } from "../models/types";

export interface SendPushParams {
  topic?: string;
  barkKey?: string;
  title: string;
  message: string;
  clickUrl?: string;
}

export class NotificationService {
  /**
   * Sends a push notification to user's private ntfy.sh topic and/or Bark key.
   */
  static async sendPush(params: SendPushParams): Promise<{ ntfySent: boolean; barkSent: boolean }> {
    const { topic, barkKey, title, message, clickUrl } = params;
    let ntfySent = false;
    let barkSent = false;

    // 1. ntfy.sh push
    if (topic && topic.trim().length > 0) {
      try {
        const cleanTopic = topic.trim().replace(/^https?:\/\/ntfy\.sh\//, "");
        const headers: Record<string, string> = {
          "Title": title,
          "Priority": "default",
          "Tags": "movie_camera,tv",
        };
        if (clickUrl) {
          headers["Click"] = clickUrl;
        }

        const res = await fetch(`https://ntfy.sh/${cleanTopic}`, {
          method: "POST",
          headers,
          body: message,
        });

        ntfySent = res.ok;
      } catch (err) {
        console.warn("ntfy.sh push notification failed:", err instanceof Error ? err.message : err);
      }
    }

    // 2. Bark push (optional)
    if (barkKey && barkKey.trim().length > 0) {
      try {
        let cleanBarkKey = barkKey.trim();
        cleanBarkKey = cleanBarkKey.replace(/^https?:\/\/api\.day\.app\//, "").replace(/^\/+|\/+$/g, "");
        const barkUrl = new URL(`https://api.day.app/${cleanBarkKey}`);
        barkUrl.pathname += `/${encodeURIComponent(title)}/${encodeURIComponent(message)}`;
        if (clickUrl) {
          barkUrl.searchParams.set("url", clickUrl);
        }

        const res = await fetch(barkUrl.toString(), { method: "GET" });
        barkSent = res.ok;
      } catch (err) {
        console.warn("Bark push failed:", err instanceof Error ? err.message : err);
      }
    }

    return { ntfySent, barkSent };
  }

  /**
   * Creates an in-app notification record in MongoDB.
   */
  static async createInAppNotification(params: {
    userId: string | ObjectId;
    title: string;
    message: string;
    link?: string;
    type?: "new_episode" | "system";
  }): Promise<NotificationDocument> {
    const { userId, title, message, link, type = "new_episode" } = params;
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    const doc: NotificationDocument = {
      userId: userObjectId,
      title,
      message,
      link: link || null,
      type,
      read: false,
      createdAt: new Date(),
    };

    const res = await db.collection<NotificationDocument>("notifications").insertOne(doc);
    return { ...doc, _id: res.insertedId };
  }

  /**
   * Fetches user's in-app notifications and total unread count.
   */
  static async getUserNotifications(userId: string | ObjectId, limit = 50): Promise<{
    notifications: NotificationDocument[];
    unreadCount: number;
  }> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    const [notifications, unreadCount] = await Promise.all([
      db
        .collection<NotificationDocument>("notifications")
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray(),
      db
        .collection("notifications")
        .countDocuments({ userId: userObjectId, read: false }),
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Counts the user's unread in-app notifications.
   */
  static async getUnreadCount(userId: string | ObjectId): Promise<number> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    return db.collection("notifications").countDocuments({ userId: userObjectId, read: false });
  }

  /**
   * Marks a single notification or all user notifications as read.
   */
  static async markAsRead(userId: string | ObjectId, notificationId?: string): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();

    if (notificationId) {
      await db.collection("notifications").updateOne(
        { _id: new ObjectId(notificationId), userId: userObjectId },
        { $set: { read: true, readAt: new Date() } }
      );
    } else {
      await db.collection("notifications").updateMany(
        { userId: userObjectId, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
    }
  }

  /**
   * Cleans up read notifications older than 30 days (run by daily cron).
   */
  static async cleanupOldNotifications(days = 30): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const db = await getDb();
    const res = await db.collection("notifications").deleteMany({
      read: true,
      createdAt: { $lt: cutoff },
    });
    return res.deletedCount;
  }
}

