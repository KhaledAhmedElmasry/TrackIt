# TrackIt

Track every film and episode you watch. Keep a watchlist, tick off episodes as you go, get a push notification when a new one airs, and get picks based on what you like.

**Live:** [track-itt.vercel.app](https://track-itt.vercel.app)

[![CI](https://github.com/KhaledAhmedElmasry/TrackIt/actions/workflows/ci.yml/badge.svg)](https://github.com/KhaledAhmedElmasry/TrackIt/actions/workflows/ci.yml)

TrackIt is a single Next.js App Router app (UI and API in one codebase) that runs entirely on free tiers and installs on your phone or desktop as a PWA.

---

## Features

- **Films and series in one place.** Search TMDB, add titles to *Want to watch*, and lists update themselves: a series moves to *Watching* when you tick an episode and to *Watched* when you finish it. Mark titles *On hold* or *Dropped* by hand.
- **Episode checklist.** Season tabs with progress, one-tap tick boxes, *Watched up to here*, *Mark season watched*, locked unaired episodes, and specials kept out of your totals.
- **Home screen that knows what's next.** *Now showing* lists the next episode of everything in progress, *Coming soon* lists upcoming air dates, and *Your reels* shows list counts.
- **New-episode alerts.** A daily job checks your series and sends one combined push per user through [ntfy](https://ntfy.sh) (private random topic) and/or [Bark](https://github.com/Finb/Bark) on iOS, plus an in-app notification.
- **Picks for you.** Google Gemini suggests titles from your ratings and history; every suggestion is checked against TMDB before it is shown.
- **Ratings** from 0 to 10, with up to two decimals.
- **Accounts without lock-in.** Email verification and password reset by email, plus 10 one-time recovery codes in case email never arrives. Export and import your whole library as JSON.
- **Fast and installable.** Installs as a PWA; pages render instantly from an on-device cache and refresh in the background; read-only offline mode.
- **Private by design.** Every query is scoped to the signed-in user, sessions are server-side and revocable, and each user's TMDB and Gemini keys are encrypted at rest with AES-256-GCM.

## Stack

| Part | Technology | Free tier |
| :--- | :--- | :--- |
| App and API | Next.js 16 (App Router), React 19, TypeScript | |
| Styling | Tailwind CSS v4 | |
| Database | MongoDB Atlas | M0 cluster (512 MB) |
| Hosting | Vercel | Hobby plan |
| Film and TV data | [TMDB API](https://developer.themoviedb.org/) | Free key per user |
| Picks | [Google Gemini](https://aistudio.google.com/) | Free key per user |
| Email | [Brevo](https://www.brevo.com/) | 300 emails/day |
| Push | ntfy.sh, Bark | Free |
| CI and backups | GitHub Actions | 2,000 minutes/month |

Each user brings their own free TMDB key (required) and Gemini key (optional, for Picks), entered in the app's Settings.

---

## Getting started

### Prerequisites

- Node.js 20.9 or newer (CI uses Node 24)
- A MongoDB Atlas connection string (see [SETUP.md](SETUP.md))

### Install and run

```bash
git clone https://github.com/KhaledAhmedElmasry/TrackIt.git
cd TrackIt
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and add your TMDB key when prompted.

Generate the three secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # MASTER_ENCRYPTION_KEY, SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
```

[SETUP.md](SETUP.md) walks through creating every free account (Atlas, TMDB, Gemini, Brevo, Vercel) step by step.

### Environment variables

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `MONGODB_URI` | Yes | Atlas connection string |
| `MONGODB_DB_NAME` | No | Database name. Defaults to `watchtrack`, the name kept from before the rename so existing data stays put |
| `MASTER_ENCRYPTION_KEY` | Yes | 64 hex characters; encrypts users' API keys. Changing it makes stored keys unreadable |
| `SESSION_SECRET` | Yes | At least 32 characters |
| `CRON_SECRET` | Yes | Protects `/api/cron/daily` (sent as `Authorization: Bearer <secret>`) |
| `APP_URL` | In production | Public URL used in email and push links, e.g. `https://track-itt.vercel.app` |
| `BREVO_API_KEY` | For email | Without it, emails are only logged to the console (handy locally) |
| `BREVO_SENDER_EMAIL` | With Brevo | Must be a sender verified in Brevo. A domain you own delivers far better than a Gmail address |
| `BREVO_SENDER_NAME` | No | Defaults to `TrackIt` |

---

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Unit tests (Vitest) |
| `npm run type-check` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npx tsx scripts/generate-icons.ts` | Re-render the PWA icons from `public/icons/*.svg` |

CI runs lint, type-check, tests and a production build on every push and pull request to `master`.

---

## Project structure

```
app/
  api/                 Route handlers: auth, tracking, tmdb, notifications, recommendations,
                       user (export/import/username/bark), keys, cron/daily, health
  title/[type]/[id]/   Film or series page
  page.tsx             Home (Now showing, Coming soon, Your reels)
  search/ lists/ recommendations/ notifications/ profile/
  login/ signup/ verify-email/ forgot-password/ reset-password/
  globals.css          Palette tokens, fonts, button and card states
  manifest.ts          PWA manifest
components/
  layout/              App shell, desktop sidebar, phone top bar and bottom tabs
  title/               Title page (actions, episode checklist, franchise list)
  auth/ pwa/ brand/
lib/
  services/            Business logic: auth, tracking, tmdb, gemini, email, notification, keys, rate limits
  auth/session.ts      Server-side sessions
  security/            Password hashing (scrypt), AES-256-GCM key encryption
  db/                  MongoDB client and indexes
  client/              Browser-only helpers: response cache, API error messages
  validations/         Zod schemas
public/                Service worker, icons
scripts/               Icon generator
tests/unit/            Vitest suite
```

[ARCHITECTURE.md](ARCHITECTURE.md) explains the layering, security model and conventions.

---

## Deployment

1. Import the repository into Vercel.
2. Add the environment variables above under **Settings → Environment Variables** (Production).
3. Set the production branch to `master`. Every push to `master` then deploys automatically.

### Daily job

`GET /api/cron/daily` checks followed series for newly aired episodes, sends the pushes, and cleans up (unverified accounts older than 7 days, read notifications older than 30 days, expired sessions and tokens). It must be called once a day with `Authorization: Bearer <CRON_SECRET>`, for example by a Vercel Cron entry in `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 8 * * *" }] }
```

To run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://track-itt.vercel.app/api/cron/daily
```

---

## Backups

`.github/workflows/backup.yml` runs every Sunday at 03:00 UTC (or on demand from the Actions tab). It dumps the database with `mongodump`, encrypts it with your `MASTER_ENCRYPTION_KEY`, and keeps it as a workflow artifact for 90 days.

It needs two repository secrets (**Settings → Secrets and variables → Actions**): `MONGODB_URI` and `MASTER_ENCRYPTION_KEY`. Atlas **Network Access** must allow GitHub's runners (`0.0.0.0/0`).

To restore, download the artifact, then:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in trackit_backup_YYYYMMDD.enc -out backup.archive -pass env:MASTER_ENCRYPTION_KEY
mongorestore --uri="$MONGODB_URI" --archive=backup.archive --gzip --drop
```

---

## Install as an app

- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu → **Install app**.
- **Desktop (Chrome / Edge):** the install icon in the address bar.

---

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
