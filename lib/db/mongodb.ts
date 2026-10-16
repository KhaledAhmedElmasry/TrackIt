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
  // Allow global caching in development and warm serverless containers
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

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

  // In development and warm serverless execution, reuse the global promise
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    // In production serverless, reuse clientPromise if cached on global scope across container lifetime
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
    return clientPromise;
  }
}

let indexesEnsured = false;

/**
 * Convenience helper to obtain the target database instance.
 * Reuses the cached MongoClient and defaults to the configured database name.
 *
 * @param dbName Optional database name override, defaults to process.env.MONGODB_DB_NAME || "watchtrack"
 */
export async function getDb(dbName?: string): Promise<Db> {
  const client = await getMongoClientPromise();
  const name = dbName || process.env.MONGODB_DB_NAME || "watchtrack";
  const db = client.db(name);

  if (!indexesEnsured) {
    indexesEnsured = true;
    import("./init-indexes")
      .then((m) => m.ensureIndexes(db))
      .catch((err) => {
        console.warn("Failed to ensure indexes automatically:", err);
        indexesEnsured = false;
      });
  }

  return db;
}

