/**
 * MongoDB Atlas Connection Singleton and Pooling Manager
 *
 * Designed specifically for Next.js App Router and Serverless deployment (Vercel).
 * Enforces connection reuse across warm serverless invocations to avoid opening
 * duplicate connection pools that would exhaust MongoDB Atlas Free Tier (M0)
 * connection limits (max 500 connections, ~100 ops/sec).
 */

import { MongoClient, MongoClientOptions, Db } from "mongodb";

// MongoDB Atlas free tier connection pooling configuration
const options: MongoClientOptions = {
  // Free tier connection limits: max 500 connections across cluster.
  // Setting maxPoolSize to 10 prevents any single warm function from hoarding connections.
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000, // Fast fail in 5s if Atlas is unreachable
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

declare global {
  // Cache the client promise on the global scope so warm serverless invocations
  // (and Next.js dev hot reloads) reuse one connection pool.
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Database name used before the WatchTrack -> TrackIt rename. Existing deployments
// store all user data here, so it stays the fallback when MONGODB_DB_NAME is unset.
const LEGACY_DEFAULT_DB_NAME = "watchtrack";

/**
 * Returns a cached Promise resolving to the active MongoClient instance.
 * Throws a descriptive error if MONGODB_URI is not provided.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Invalid or missing environment variable: 'MONGODB_URI'. " +
        "Please configure your MongoDB Atlas connection string in your .env.local file or Vercel project settings."
    );
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((err) => {
      // Do not cache a failed connection attempt; the next request retries.
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

/**
 * Convenience helper to obtain the target database instance.
 * Reuses the cached MongoClient and defaults to the configured database name.
 *
 * Indexes are not created here: doing so on every cold start delayed the first
 * request. They are ensured by the daily cron job (see lib/db/init-indexes.ts).
 *
 * @param dbName Optional database name override, defaults to process.env.MONGODB_DB_NAME || "watchtrack"
 */
export async function getDb(dbName?: string): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(dbName || process.env.MONGODB_DB_NAME || LEGACY_DEFAULT_DB_NAME);
}
