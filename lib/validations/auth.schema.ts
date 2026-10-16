/**
 * Zod Schemas for Authentication, Passwords, Recovery Codes, and Key API Inputs
 */

import { z } from "zod";

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(255, "Email address is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(32, "Invalid verification token format"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
});

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().trim().min(32, "Invalid reset token format"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const resetPasswordWithRecoveryCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
  recoveryCode: z
    .string()
    .trim()
    .min(10, "Invalid recovery code format")
    .max(20, "Invalid recovery code format"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Za-z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Current password is required to delete account"),
});

export const saveKeySchema = z.object({
  keyType: z.enum(["tmdb", "gemini"]),
  key: z.string().trim().min(8, "API key must be at least 8 characters long"),
});

export const deleteKeySchema = z.object({
  keyType: z.enum(["tmdb", "gemini"]),
});

