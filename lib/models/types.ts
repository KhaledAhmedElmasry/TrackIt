/**
 * Core Data Models and Database Schema Type Definitions
 *
 * Implements the minimal-storage schema required for MongoDB Atlas Free Tier (512MB).
 * Watched episodes are stored as compact numerical ranges [start, end] per season,
 * allowing tens of thousands of episodes per user without bloating document size.
 */

import { ObjectId } from "mongodb";

export type MediaType = "movie" | "tv";

export type WatchStatus = "want_to_watch" | "currently_watching" | "watched";

export type StatusOverride = "dropped" | "on_hold" | null;

/**
 * Encrypted API key container
 * Stores AES-256-GCM cipher data. Master encryption key is never persisted here.
 */
export interface EncryptedKeyData {
  encrypted: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  lastFour: string;
  updatedAt: Date;
}

export interface UserRecoveryCode {
  codeHash: string;
  used: boolean;
  usedAt?: Date;
}

export interface UserDocument {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  isVerified: boolean;
  verificationTokenHash?: string | null;
  verificationExpiresAt?: Date | null;
  resetTokenHash?: string | null;
  resetExpiresAt?: Date | null;
  recoveryCodes: UserRecoveryCode[];
  keys?: {
    tmdb?: EncryptedKeyData;
    gemini?: EncryptedKeyData;
    barkKey?: string;
  };
  ntfyTopic: string; // Long random unguessable topic generated per user
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compact representation of watched episodes within a season.
 * Stored as contiguous ranges [fromEpisode, toEpisode] inclusive.
 * e.g., [[1, 5], [7, 7], [9, 12]]
 */
export interface SeasonWatchRange {
  season: number;
  ranges: [number, number][]; // [from, to] inclusive
}

export interface MinimalSnapshot {
  title: string;
  posterPath: string | null;
  startYear: number | null;
  endYear: number | null;
  totalSeasons?: number;
}

export interface LastSeenAiredEpisode {
  seasonNumber: number;
  episodeNumber: number;
  airDate?: string;
}

export interface TrackedItemDocument {
  _id?: ObjectId;
  userId: ObjectId;
  tmdbId: number;
  mediaType: MediaType;
  status: WatchStatus; // Derived & indexed for high-performance list queries
  override?: StatusOverride; // Manual "dropped" or "on_hold"
  rating?: number | null; // 1-5 star rating
  notify: boolean; // Opt-in push notification toggle
  minimalSnapshot: MinimalSnapshot;
  lastSeenAiredEpisode?: LastSeenAiredEpisode | null;
  watchedEpisodes: SeasonWatchRange[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDocument {
  _id?: ObjectId;
  sessionTokenHash: string; // SHA-256 hash of the random session token
  userId: ObjectId;
  userAgent?: string;
  ip?: string;
  expiresAt: Date; // Indexed with MongoDB TTL
  createdAt: Date;
}

export interface RateLimitDocument {
  _id?: ObjectId;
  key: string; // e.g. "auth:login:ip:127.0.0.1"
  count: number;
  expiresAt: Date; // Indexed with MongoDB TTL
}

export interface MetadataCacheDocument {
  _id?: ObjectId;
  cacheKey: string; // e.g., "tmdb:tv:1399" or "tmdb:movie:550"
  mediaType: MediaType;
  tmdbId: number;
  data: unknown;
  isFinished: boolean; // Finished titles cache for 7 days, ongoing for 1 day
  expiresAt: Date; // Indexed with MongoDB TTL
  updatedAt: Date;
}

export interface NotificationDocument {
  _id?: ObjectId;
  userId: ObjectId;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName?: string;
  airDate: string;
  isRead: boolean;
  readAt?: Date | null;
  expiresAt: Date; // MongoDB TTL index (cleans up after 30 days)
  createdAt: Date;
}

