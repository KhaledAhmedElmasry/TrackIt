# WatchTrack — System Architecture & Engineering Guide

This document defines the architectural patterns, security model, and structural guidelines of **WatchTrack**. Any future developer or AI assistant must adhere strictly to these conventions.

---

## 1. Architectural Philosophy: The Monolithic MVC in Next.js

WatchTrack is built as **ONE cohesive, monolithic Next.js App Router application**. There is no separate NestJS or Express backend, and no third-party database-as-a-service abstraction layer (e.g. Supabase). All backend routes and business logic execute inside Next.js Route Handlers.

```
┌────────────────────────────────────────────────────────┐
│                   Next.js App Router                   │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │   Client UI / PWA  │      │  API Route Handlers  │  │
│  │  (Apple Dark Theme)│◄────►│  (Thin Controllers)  │  │
│  └────────────────────┘      └──────────┬───────────┘  │
│                                         │              │
│                              ┌──────────▼───────────┐  │
│                              │    Services Layer    │  │
│                              │   (Business Logic)   │  │
│                              └──────────┬───────────┘  │
│                                         │              │
│                              ┌──────────▼───────────┐  │
│                              │     Models Layer     │  │
│                              │  (Data & Compact DB) │  │
│                              └──────────┬───────────┘  │
└─────────────────────────────────────────┼──────────────┘
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
            MongoDB Atlas (M0)                         External Services
      (Cached Connection Pool)                   (TMDB, Gemini, Brevo, ntfy)
```

### Directory Structure & Layers

- `app/`: Next.js App Router pages, layout, and API route handlers.
  - `app/api/`: **Thin Controllers** — parse query/body, validate using Zod, invoke the appropriate Service, return standardized JSON.
- `lib/models/`: **Data Layer** — TypeScript interfaces, MongoDB schema definitions, index initialization.
- `lib/services/`: **Business Logic Layer** — pure domain logic decoupled from HTTP request objects.
- `lib/validations/`: **Validation Schemas** — centralized Zod schemas for all API payloads and environment variables.
- `lib/errors/`: **Centralized Error Handling** — typed operational error classes (`AppError`, `ValidationError`, `NotFoundError`) and API response serializers.
- `lib/db/`: **Database Connection** — serverless-optimized MongoDB Atlas connection singleton.
- `components/`: UI components (Apple iOS style, glassmorphism, responsive navigation, PWA offline handling).

---

## 2. Serverless Database Connection Strategy (MongoDB Atlas Free M0)

### The Challenge
MongoDB Atlas Free Tier provides **512 MB storage** and a hard ceiling of **500 concurrent connections** with **~100 operations/sec burst limit**. Naive MongoDB connections created on every serverless function invocation would quickly exhaust Atlas connections.

### The Solution: Global Singleton Connection Reuse
- In `lib/db/mongodb.ts`, we store `_mongoClientPromise` on `globalThis`.
- In local development and across warm Vercel serverless lambda containers, `getMongoClientPromise()` returns the existing cached promise.
- Connection pooling parameters:
  - `maxPoolSize: 10`: limits connections per warm lambda.
  - `minPoolSize: 0`: allows idle sockets to spin down cleanly.
  - `serverSelectionTimeoutMS: 5000`: fast fail instead of indefinite request hangs.

---

## 3. Storage Minimization: Compact Season Ranges

To allow thousands of titles and tens of thousands of episodes per user without exceeding the 512 MB free tier:
- Watched episodes are **never stored as individual documents**.
- Episodes are stored compactly within the `tracked_items` document as **contiguous numerical ranges per season**:
  ```typescript
  // Represents episodes 1 through 10, 12, and 15 through 20 watched in Season 1
  {
    season: 1,
    ranges: [[1, 10], [12, 12], [15, 20]]
  }
  ```
- This reduces storage footprint by over 95% compared to individual episode records.

---

## 4. Security & Privacy Model

### Zero Cross-User Leakage
- Every database query in the service layer is strictly scoped by `userId: session.userId`.
- No route or API endpoint may ever expose another user's document or ID.

### AES-256-GCM User Key Encryption
- Users supply their own TMDB and Google Gemini keys.
- Keys are encrypted before writing to MongoDB using **AES-256-GCM**:
  - `MASTER_ENCRYPTION_KEY`: 32-byte secret stored in environment variables.
  - Unique random 12-byte IV per record.
  - Authentication tag stored alongside the ciphertext.
  - `keyVersion` field stored for zero-downtime key rotation.
- Plaintext keys **never leave the server** and are **never logged or sent back to the browser**. Settings UI displays only the last 4 characters.

### Revocable Sessions & Authentication
- Password hashing using secure scrypt with high work factor.
- Random session tokens stored **hashed (SHA-256)** in MongoDB with a TTL index on `expiresAt`.
- Session cookies configured as:
  `httpOnly: true`, `secure: true`, `sameSite: "lax"`, `path: "/"`.
- Rate limiting implemented directly via MongoDB collections with TTL counters (`rate_limits`) — no paid Redis required.
- Each user receives **8-10 one-time recovery backup codes** at signup as a guaranteed fallback to recover accounts if email deliverability fails.

---

## 5. PWA Shell & Apple iOS Design System

- **Dark Theme ONLY**: Strict dark mode with deep black `#000000` system background and `#161618` card surfaces. No light mode permitted.
- **Glassmorphism**: Apple-style translucent blurred bars (`backdrop-filter: blur(24px) saturate(190%)`).
- **Responsive Navigation**:
  - Phone: Translucent 5-tab bottom navigation bar with safe-area insets (`env(safe-area-inset-bottom)`) and minimum 44px touch targets.
  - PC / Desktop: Fixed left sidebar with brand badge and TMDB attribution.
- **Top Header**: Translucent blurred header with unread notification bell badge.
- **Service Worker (`public/sw.js`)**: Caches App Shell assets for instant launch. Detects offline state, rendering an iOS-style translucent amber banner and disabling write actions (read-only offline in v1).

---

## 6. Daily Background Cron Job (Vercel Cron)

- Route: `GET /api/cron/daily`
- Authentication: Protected by `Authorization: Bearer <CRON_SECRET>`
- Idempotent and resumable in batches to remain under Vercel serverless execution limits and Atlas ~100 ops/sec.
- Deduplicates tracked series across users, fetching TMDB updates with one user's decrypted key and updating in-app notifications and ntfy.sh pushes.
- Performs automated cleanup of unverified accounts (>7 days), read notifications (>30 days), and expired tokens.

