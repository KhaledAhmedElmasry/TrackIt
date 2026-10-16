import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMongoClientPromise } from "@/lib/db/mongodb";

describe("MongoDB Connection Manager", () => {
  const originalUri = process.env.MONGODB_URI;

  beforeEach(() => {
    delete process.env.MONGODB_URI;
    global._mongoClientPromise = undefined;
  });

  afterEach(() => {
    process.env.MONGODB_URI = originalUri;
    global._mongoClientPromise = undefined;
  });

  it("should throw an informative error when MONGODB_URI is not set", () => {
    expect(() => getMongoClientPromise()).toThrowError(/Invalid or missing environment variable: 'MONGODB_URI'/);
  });
});

