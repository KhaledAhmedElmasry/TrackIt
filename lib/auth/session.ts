/**
 * Server-Side Session Manager
 *
 * Implements revocable, cryptographically secure sessions:
 * - Session tokens are generated with 32 random bytes (64-character hex).
 * - Stored in MongoDB solely as SHA-256 hashes with automatic TTL expiration.
 * - Stored in the browser inside httpOnly, Secure, SameSite=Lax cookies.
 * - Allows instant session revocation and full account logout across devices.
 */

import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import { generateRandomToken, hashToken } from "../security/crypto";
import { SessionDocument, UserDocument } from "../models/types";

export const SESSION_COOKIE_NAME = "wt_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const LEGACY_TOPIC_PREFIX = "watchtrack-usr-";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username?: string;
  isVerified: boolean;
  ntfyTopic: string;
  barkKey?: string;
  hasTmdbKey: boolean;
  hasGeminiKey: boolean;
  createdAt: Date;
}

export interface SessionContext {
  user: AuthenticatedUser;
  sessionId: string;
}

/**
 * Creates a new revocable session in MongoDB for a user and returns the plaintext token.
 */
export async function createSession(
  userId: ObjectId,
  userAgent?: string,
  ip?: string
): Promise<string> {
  const db = await getDb();
  const token = generateRandomToken(32);
  const tokenHash = hashToken(token);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const sessionDoc: SessionDocument = {
    sessionTokenHash: tokenHash,
    userId,
    userAgent,
    ip,
    expiresAt,
    createdAt: new Date(),
  };

  await db.collection("sessions").insertOne(sessionDoc);
  return token;
}

/**
 * Validates the session token from cookies or parameter, returning the authenticated user.
 */
export async function getSessionContext(tokenOverride?: string): Promise<SessionContext | null> {
  let token = tokenOverride;

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // During Next.js static prerendering, cookies() throws a dynamic bail-out
      return null;
    }
  }

  if (!token) {
    return null;
  }

  try {
    const tokenHash = hashToken(token);
    const db = await getDb();

    // Single round trip: session joined with its user (secrets projected out).
    const [session] = await db
      .collection<SessionDocument>("sessions")
      .aggregate<SessionDocument & { user: UserDocument }>([
        { $match: { sessionTokenHash: tokenHash, expiresAt: { $gt: new Date() } } },
        { $limit: 1 },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
            pipeline: [
              {
                $project: {
                  passwordHash: 0,
                  recoveryCodes: 0,
                  verificationTokenHash: 0,
                  resetTokenHash: 0,
                },
              },
            ],
          },
        },
        { $unwind: "$user" },
      ])
      .toArray();

    const user = session?.user;
    if (!user || !user._id) {
      return null;
    }

    // One-time rename of topics created before the WatchTrack -> TrackIt rebrand
    if (user.ntfyTopic?.startsWith(LEGACY_TOPIC_PREFIX)) {
      user.ntfyTopic = `trackit-usr-${user.ntfyTopic.slice(LEGACY_TOPIC_PREFIX.length)}`;
      await db
        .collection<UserDocument>("users")
        .updateOne({ _id: user._id }, { $set: { ntfyTopic: user.ntfyTopic, updatedAt: new Date() } });
    }

    return {
      user: {
        id: user._id.toHexString(),
        email: user.email,
        username: user.username || "",
        isVerified: user.isVerified,
        ntfyTopic: user.ntfyTopic,
        barkKey: user.barkKey || "",
        hasTmdbKey: Boolean(user.keys?.tmdb?.encrypted),
        hasGeminiKey: Boolean(user.keys?.gemini?.encrypted),
        createdAt: user.createdAt,
      },
      sessionId: session._id ? session._id.toHexString() : "",
    };
  } catch (err) {
    console.warn("Session check bypassed (database unconfigured or unreachable):", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Sets the httpOnly, Secure, SameSite session cookie.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clears the session cookie from the client.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Revokes the current session from MongoDB.
 */
export async function revokeCurrentSession(tokenOverride?: string): Promise<void> {
  let token = tokenOverride;
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (token) {
    const tokenHash = hashToken(token);
    const db = await getDb();
    await db.collection("sessions").deleteOne({ sessionTokenHash: tokenHash });
  }

  await clearSessionCookie();
}

/**
 * Revokes all sessions for a user (e.g., on password reset or account security compromise).
 */
export async function revokeAllUserSessions(userId: ObjectId | string): Promise<void> {
  const db = await getDb();
  const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
  await db.collection("sessions").deleteMany({ userId: userObjectId });
}
