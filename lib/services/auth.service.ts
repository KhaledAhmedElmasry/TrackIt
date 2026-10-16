/**
 * Core Authentication and Account Lifecycle Service
 *
 * Implements:
 * - Scrypt password hashing with unique salts.
 * - 8-10 one-time recovery backup codes.
 * - Single-use 30-minute verification and reset tokens (stored as SHA-256 hashes).
 * - MongoDB TTL rate limiting with temporary lockout protection.
 * - Server-side revocable session generation.
 * - Permanent cascaded account deletion removing all user data.
 */

import { ObjectId } from "mongodb";
import { getDb } from "../db/mongodb";
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from "../security/crypto";
import { RateLimitService } from "./rate-limit.service";
import { EmailService } from "./email.service";
import { createSession, revokeAllUserSessions } from "../auth/session";
import { UserDocument } from "../models/types";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../errors/app-error";

const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export interface SignupResult {
  userId: string;
  email: string;
  sessionToken: string;
  recoveryCodes: string[];
}

export interface LoginResult {
  userId: string;
  email: string;
  isVerified: boolean;
  sessionToken: string;
}

export class AuthService {
  /**
   * Registers a new user account:
   * - Enforces rate limiting per IP.
   * - Generates 10 one-time recovery backup codes.
   * - Creates unguessable private ntfy topic.
   * - Dispatches 30-minute verification email.
   * - Creates active session allowing immediate app use.
   */
  static async signup(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<SignupResult> {
    const { email, password, ip = "127.0.0.1", userAgent } = params;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Rate limit signup attempts (max 5 per IP per hour)
    await RateLimitService.assert(`auth:signup:${ip}`, 5);

    const db = await getDb();
    const users = db.collection("users");

    // 2. Check for existing account
    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      await RateLimitService.increment(`auth:signup:${ip}`, 3600);
      throw new ConflictError("An account with this email address already exists.");
    }

    // 3. Cryptographic preparations
    const passwordHash = await hashPassword(password);
    const { plainCodes, hashedCodes } = generateRecoveryCodes(10);
    const ntfyTopic = `watchtrack-usr-${generateRandomToken(16)}`;

    const verificationToken = generateRandomToken(32);
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    // 4. Save user document
    const userDoc: UserDocument = {
      email: normalizedEmail,
      passwordHash,
      isVerified: false,
      verificationTokenHash,
      verificationExpiresAt,
      recoveryCodes: hashedCodes,
      ntfyTopic,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await users.insertOne(userDoc);
    const userId = insertResult.insertedId;

    // 5. Create initial session
    const sessionToken = await createSession(userId, userAgent, ip);

    // 6. Send verification email (non-blocking failure safe)
    EmailService.sendVerificationEmail(normalizedEmail, verificationToken).catch((err) =>
      console.error("Async verification email dispatch error:", err)
    );

    return {
      userId: userId.toHexString(),
      email: normalizedEmail,
      sessionToken,
      recoveryCodes: plainCodes,
    };
  }

  /**
   * Authenticates user with email & password:
   * - Rate-limited with temporary lockout on repeated failures.
   * - Timing-safe password verification.
   * - Returns revocable session token.
   */
  static async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const { email, password, ip = "127.0.0.1", userAgent } = params;
    const normalizedEmail = email.trim().toLowerCase();

    const rateKeyIp = `auth:login:ip:${ip}`;
    const rateKeyEmail = `auth:login:email:${normalizedEmail}`;

    // Max 5 failed attempts per 15 minutes before temporary lockout
    await RateLimitService.assert(rateKeyIp, 5);
    await RateLimitService.assert(rateKeyEmail, 5);

    const db = await getDb();
    const user = await db.collection("users").findOne<UserDocument>({ email: normalizedEmail });

    if (!user || !user._id) {
      await RateLimitService.increment(rateKeyIp, 900);
      await RateLimitService.increment(rateKeyEmail, 900);
      throw new AuthenticationError("Invalid email or password");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await RateLimitService.increment(rateKeyIp, 900);
      await RateLimitService.increment(rateKeyEmail, 900);
      throw new AuthenticationError("Invalid email or password");
    }

    // Reset rate limit counters upon successful login
    await RateLimitService.reset(rateKeyIp);
    await RateLimitService.reset(rateKeyEmail);

    const sessionToken = await createSession(user._id, userAgent, ip);

    return {
      userId: user._id.toHexString(),
      email: user.email,
      isVerified: user.isVerified,
      sessionToken,
    };
  }

  /**
   * Verifies an email address using a single-use 30-minute token.
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; email: string }> {
    const tokenHash = hashToken(token);
    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({
      verificationTokenHash: tokenHash,
      verificationExpiresAt: { $gt: new Date() },
    });

    if (!user || !user._id) {
      throw new ValidationError(
        "Invalid or expired verification link. Please sign in and request a new verification email."
      );
    }

    await users.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true, updatedAt: new Date() },
        $unset: { verificationTokenHash: "", verificationExpiresAt: "" },
      }
    );

    return { success: true, email: user.email };
  }

  /**
   * Resends the verification email with a fresh 30-minute token.
   */
  static async resendVerification(userId: string | ObjectId, ip = "127.0.0.1"): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;

    // Rate limit: max 3 resends per user / IP per 15 minutes
    await RateLimitService.assert(`auth:resend:${userObjectId}`, 3);
    await RateLimitService.assert(`auth:resend:ip:${ip}`, 5);

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({ _id: userObjectId });
    if (!user) {
      throw new NotFoundError("User account not found");
    }

    if (user.isVerified) {
      throw new ValidationError("This account is already verified.");
    }

    const verificationToken = generateRandomToken(32);
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

    await users.updateOne(
      { _id: userObjectId },
      {
        $set: {
          verificationTokenHash,
          verificationExpiresAt,
          updatedAt: new Date(),
        },
      }
    );

    await RateLimitService.increment(`auth:resend:${userObjectId}`, 900);
    await RateLimitService.increment(`auth:resend:ip:${ip}`, 900);

    await EmailService.sendVerificationEmail(user.email, verificationToken);
  }

  /**
   * Requests a password reset link.
   * Anti-Enumeration: Always returns the same success response regardless of email existence.
   */
  static async requestPasswordReset(email: string, ip = "127.0.0.1"): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Rate limit: max 5 requests per IP per hour
    await RateLimitService.assert(`auth:reset_req:ip:${ip}`, 5);
    await RateLimitService.increment(`auth:reset_req:ip:${ip}`, 3600);

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({ email: normalizedEmail });

    // Privacy rule: Only send password reset emails to verified accounts
    if (user && user._id && user.isVerified) {
      const resetToken = generateRandomToken(32);
      const resetTokenHash = hashToken(resetToken);
      const resetExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            resetTokenHash,
            resetExpiresAt,
            updatedAt: new Date(),
          },
        }
      );

      EmailService.sendPasswordResetEmail(normalizedEmail, resetToken).catch((err) =>
        console.error("Async reset email dispatch error:", err)
      );
    }

    return {
      message:
        "If a verified account with that email address exists, password reset instructions have been sent.",
    };
  }

  /**
   * Resets password using a verified single-use 30-minute token.
   * Automatically revokes all existing sessions across all devices.
   */
  static async resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({
      resetTokenHash: tokenHash,
      resetExpiresAt: { $gt: new Date() },
    });

    if (!user || !user._id) {
      throw new ValidationError(
        "Invalid or expired password reset link. Please submit a new reset request."
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash, updatedAt: new Date() },
        $unset: { resetTokenHash: "", resetExpiresAt: "" },
      }
    );

    // Revoke all existing sessions for security
    await revokeAllUserSessions(user._id);
  }

  /**
   * Resets password using a one-time recovery backup code.
   * Guaranteed fallback even if Brevo transactional email lands in spam or fails.
   */
  static async resetPasswordWithRecoveryCode(params: {
    email: string;
    recoveryCode: string;
    newPassword: string;
    ip?: string;
  }): Promise<void> {
    const { email, recoveryCode, newPassword, ip = "127.0.0.1" } = params;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = normalizeRecoveryCode(recoveryCode);
    const codeHash = hashToken(normalizedCode);

    // Rate limit recovery attempts: max 5 per IP per 15 minutes
    await RateLimitService.assert(`auth:recovery:${ip}`, 5);

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({
      email: normalizedEmail,
      "recoveryCodes.codeHash": codeHash,
      "recoveryCodes.used": false,
    });

    if (!user || !user._id) {
      await RateLimitService.increment(`auth:recovery:${ip}`, 900);
      throw new AuthenticationError("Invalid email address or recovery code.");
    }

    const newPasswordHash = await hashPassword(newPassword);

    // Mark the matched recovery code as used and update password hash
    await users.updateOne(
      { _id: user._id, "recoveryCodes.codeHash": codeHash },
      {
        $set: {
          passwordHash: newPasswordHash,
          "recoveryCodes.$.used": true,
          "recoveryCodes.$.usedAt": new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Revoke all existing sessions
    await revokeAllUserSessions(user._id);
  }

  /**
   * Permanently deletes a user account and cascaded data:
   * - User record
   * - All active sessions
   * - All tracked items and episode history
   * - All notifications
   */
  static async deleteAccount(userId: string | ObjectId, passwordConfirm: string): Promise<void> {
    const userObjectId = typeof userId === "string" ? new ObjectId(userId) : userId;
    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<UserDocument>({ _id: userObjectId });
    if (!user) {
      throw new NotFoundError("User account not found");
    }

    const isValid = await verifyPassword(passwordConfirm, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError("Incorrect password. Account deletion aborted.");
    }

    // Cascaded permanent deletion
    await Promise.all([
      users.deleteOne({ _id: userObjectId }),
      db.collection("sessions").deleteMany({ userId: userObjectId }),
      db.collection("tracked_items").deleteMany({ userId: userObjectId }),
      db.collection("notifications").deleteMany({ userId: userObjectId }),
    ]);
  }
}
