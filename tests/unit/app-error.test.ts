import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  handleApiError,
} from "@/lib/errors/app-error";
import { z } from "zod";

describe("Application Error Classes and Handler", () => {
  it("should create AppError with proper status codes and properties", () => {
    const error = new AppError("Test message", 400, "VALIDATION_ERROR");
    expect(error.message).toBe("Test message");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.isOperational).toBe(true);
  });

  it("should create specific error subclasses with default status codes", () => {
    const valErr = new ValidationError("Bad input");
    expect(valErr.statusCode).toBe(400);
    expect(valErr.code).toBe("VALIDATION_ERROR");

    const authErr = new AuthenticationError();
    expect(authErr.statusCode).toBe(401);
    expect(authErr.code).toBe("UNAUTHORIZED");

    const notFound = new NotFoundError("Movie not found");
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe("NOT_FOUND");

    const rateLimit = new RateLimitError();
    expect(rateLimit.statusCode).toBe(429);
    expect(rateLimit.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("handleApiError should serialize AppError correctly", async () => {
    const err = new NotFoundError("Item not found");
    const response = handleApiError(err);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Item not found",
      },
    });
  });

  it("handleApiError should serialize Zod validation errors cleanly", async () => {
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse({ email: "invalid-email" });

    if (!parseResult.success) {
      const response = handleApiError(parseResult.error);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
    }
  });

  it("handleApiError uses the first validation issue as the readable message", async () => {
    const schema = z.object({ password: z.string().regex(/[0-9]/, "Password must contain at least one number") });
    const parseResult = schema.safeParse({ password: "password" });

    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      const body = await handleApiError(parseResult.error).json();
      expect(body.error.message).toBe("Password must contain at least one number");
    }
  });

  it("handleApiError should mask unexpected internal errors in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const secretError = new Error("Database password leaked in stack trace");
    const response = handleApiError(secretError);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.message).not.toContain("password");

    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});
