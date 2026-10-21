# TrackIt

> A private, fast, and secure movie and TV series tracker built as ONE monolithic Next.js App Router application with Apple iOS dark-mode design, installable as a native-feeling Progressive Web App (PWA).

[![CI](https://github.com/your-username/trackit/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/trackit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero-Cost Stack](https://img.shields.io/badge/Cost-$0%2Fmonth-brightgreen.svg)](#zero-cost-free-tier-stack)

---

## Zero-Cost Free-Tier Stack

TrackIt is engineered from the ground up to run **100% on free tiers with zero credit cards required**:

| Component | Technology | Free Tier Specification |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Strict TS) | Monolithic layered MVC in route handlers |
| **Styling** | Tailwind CSS v4 | Dark-theme ONLY, Apple iOS frosted glass |
| **Database** | MongoDB Atlas (M0 Free Cluster) | 512 MB, singleton pool, compact season ranges |
| **Hosting** | Vercel Hobby Plan | Free hosting + Vercel Cron (1 daily scheduled job) |
| **Media Metadata** | The Movie Database (TMDB) API | Free developer keys, cached with MongoDB TTL |
| **AI Recommendations** | Google Gemini API | Free tier via Google AI Studio (Gemini Flash) |
| **Transactional Email** | Brevo | 300 emails/day free tier |
| **Push Notifications** | ntfy.sh / Bark | Zero-cost private random topic per user |
| **CI / Automation** | GitHub Actions | 2,000 free runner minutes/month |

---

## Key Highlights

- **Installable PWA**: Standalone display, home-screen shortcut, safe-area inset handling (`viewport-fit=cover`), custom app icons.
- **Apple iOS Design**: Translucent blurred bars (`backdrop-filter`), rounded cards, SF Pro system fonts, fluid animations.
- **Offline Read-Only Shell**: Service Worker precaches the App Shell; real-time offline detection renders an amber status banner and disables write operations.
- **Privacy & Security**: Every query strictly scoped by session `userId`. User TMDB and Gemini keys encrypted at rest with **AES-256-GCM**.
- **Compact Season Range Storage**: Episodes tracked as contiguous ranges `[from, to]` per season to store tens of thousands of episodes within 512 MB.
- **8-10 One-Time Recovery Codes**: Guaranteed account recovery fallback if transactional email lands in spam.

---

## Project Structure

```
├── .github/workflows/ci.yml # Free GitHub Actions CI (lint, type-check, vitest, build)
├── app/
│   ├── api/
│   │   └── health/route.ts   # System health and MongoDB ping endpoint
│   ├── lists/page.tsx        # Tracked lists (Want to Watch, Watching, Watched)
│   ├── notifications/page.tsx# New episode release alerts
│   ├── profile/page.tsx      # Account settings & AES-256 encrypted keys
│   ├── recommendations/page.tsx # Gemini AI recommendations
│   ├── search/page.tsx       # TMDB search with year filter
│   ├── globals.css           # Apple dark-only theme & glassmorphism utilities
│   ├── layout.tsx            # PWA viewport, safe-area layout, AppShell wrapper
│   ├── manifest.ts           # Next.js App Router Web App Manifest
│   └── page.tsx              # Home dashboard with Continue Watching row
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx     # Responsive layout orchestrator
│   │   ├── bottom-nav.tsx    # Mobile 5-tab translucent bottom bar (min 44px targets)
│   │   ├── sidebar.tsx       # Desktop PC left sidebar with TMDB attribution
│   │   └── top-header.tsx    # Header with unread notification bell badge
│   └── pwa/
│       ├── offline-context.tsx # Connectivity tracking & translucent offline alert
│       └── service-worker-register.tsx # Client service worker installer
├── lib/
│   ├── db/
│   │   ├── init-indexes.ts   # Idempotent MongoDB compound and TTL indexes
│   │   └── mongodb.ts        # Serverless connection pool singleton
│   ├── errors/
│   │   └── app-error.ts      # Typed error classes & secure API error serializer
│   ├── models/
│   │   └── types.ts          # Minimal storage TypeScript document interfaces
│   ├── utils/
│   │   └── cn.ts             # Lightweight Tailwind class merger
│   └── validations/
│       └── env.schema.ts     # Zod schema for runtime environment variables
├── public/
│   ├── icons/                # High-res PWA icons (192x192, 512x512, SVG, Apple touch)
│   ├── manifest.json         # Standalone PWA manifest fallback
│   └── sw.js                 # App Shell service worker
├── tests/
│   └── unit/                 # Vitest test suite (errors, env, db, UI components)
├── ARCHITECTURE.md           # Engineering patterns, MVC layering, and design rules
├── SETUP.md                  # Numbered manual setup steps with direct links
└── vitest.config.mts         # Vitest configuration with JSDOM and path aliases
```

---

## Quickstart (Local Development)

### 1. Prerequisites
- **Node.js**: v20+ or v24+
- **npm**: v10+

### 2. Clone and Install
```bash
git clone https://github.com/your-username/trackit.git
cd trackit
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

Generate your cryptographic secrets and update `.env.local` (see [SETUP.md](file:///c:/Main%20Directory/Work/TrackIt/SETUP.md) for detailed instructions):
```bash
# Generate 32-byte (64-hex) Master Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate 32-byte Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Cron Secret
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Testing Scripts

```bash
# Run unit test suite (Vitest)
npm test

# Run strict TypeScript type check
npm run type-check

# Run ESLint code quality check
npm run lint

# Build optimized production bundle
npm run build
```

---

## Installing as a PWA on Your Device

- **iOS (iPhone/iPad Safari)**:
  1. Open TrackIt in Safari.
  2. Tap the **Share** button (box with upward arrow).
  3. Scroll down and tap **Add to Home Screen**.
  4. Launch TrackIt from your home screen for full standalone experience.
- **Android (Chrome)**:
  1. Open TrackIt in Chrome.
  2. Tap the menu (three dots) -> **Install App** or **Add to Home screen**.
- **Desktop (Chrome/Edge/Brave)**:
  1. Click the **Install** icon in the URL address bar.

---

## Database Backup and Restore Procedure

TrackIt keeps all user lists and history in your free MongoDB Atlas M0 cluster.

### 1. Manual Backup (Using MongoDB Database Tools)
To export an encrypted full dump locally:
```bash
mongodump --uri="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/watchtrack" --out="./backup-$(date +%Y%m%d)"
```

### 2. Manual Restore
To restore data into a fresh cluster:
```bash
mongorestore --uri="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/watchtrack" --drop "./backup-YYYYMMDD/watchtrack"
```

### 3. Automated Weekly Backup
In Phase 6, a scheduled GitHub Actions workflow runs weekly with encrypted artifact retention.

---

## Documentation Links

- [SETUP.md](file:///c:/Main%20Directory/Work/TrackIt/SETUP.md): Numbered steps and links for MongoDB Atlas, Vercel, TMDB, Gemini, and Brevo.
- [ARCHITECTURE.md](file:///c:/Main%20Directory/Work/TrackIt/ARCHITECTURE.md): Technical deep-dive on MVC structure, serverless pooling, and AES-256 encryption.

---

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
