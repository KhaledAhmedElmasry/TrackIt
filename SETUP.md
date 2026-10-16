# WatchTrack — Complete Setup & Verification Guide

This guide contains **exact, numbered, step-by-step instructions** and direct links to create all required free accounts, configure your environment, deploy the application, and verify every single feature.

> **Zero Paid Services Guarantee**: Every single component in WatchTrack operates on a **100% free tier** with **no credit card required**.

---

## Free-Tier Allocation & Service Limits

| Service | Free Tier Allocation | Credit Card Required? | Notes / Safety Margins |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas** | 512 MB storage, 500 connections, ~100 ops/sec | ❌ No | Singleton connection pool (`maxPoolSize: 10`), compact range math |
| **Vercel** | 100 GB bandwidth, Serverless functions, 1 Cron job | ❌ No | Cron executes once daily via protected GET route (`/api/cron/daily`) |
| **TMDB API** | Free non-commercial developer access (~40 req/10s) | ❌ No | Shared metadata cached in MongoDB TTL cache |
| **Google Gemini API** | Free tier (15 RPM, 1,500 requests/day on Flash models) | ❌ No | Only invoked on-demand when tapping "Get Recommendations" |
| **Brevo** | 300 emails/day (9,000/month) | ❌ No | Transactional emails for 30-min verification & password resets |
| **ntfy.sh** | Unlimited public server pushes | ❌ No | Zero signup; uses long random private topic per user |
| **GitHub Actions** | 2,000 free runner minutes/month | ❌ No | Runs CI lint/tests and automated weekly encrypted MongoDB backups |

---

## Step 1: Pre-Generated Cryptographic Secrets

Your local `.env.local` has been pre-populated with secure cryptographic keys. If you ever need to generate new ones:

```bash
# 1. 32-byte (64-character hex) Master Encryption Key for AES-256-GCM
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 32-byte Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Daily Cron Bearer Secret
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Values:
- `MASTER_ENCRYPTION_KEY`: 64-character hex string (used to encrypt user TMDB and Gemini keys at rest)
- `SESSION_SECRET`: 64-character string (used to sign session cookies and integrity hashes)
- `CRON_SECRET`: 48-character string (sent in `Authorization: Bearer <token>` by Vercel Cron)

---

## Step 2: Set Up MongoDB Atlas Free Cluster (M0)

1. Go to [MongoDB Atlas Registration](https://www.mongodb.com/cloud/atlas/register).
2. Sign up with email or Google/GitHub. No credit card required.
3. In the setup wizard, select **M0 Free** (512 MB Storage).
4. Choose your preferred cloud provider (AWS, GCP, or Azure) and closest region.
5. Under **Security Quickstart**:
   - **Database User**: Create a username (e.g. `watchtrack_user`) and a secure password.
   - **Network Access**: Add IP Address `0.0.0.0/0` (Allow access from anywhere) so Vercel and local dev can connect.
6. Click **Database** in the sidebar, click **Connect**, select **Drivers** (Node.js).
7. Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
8. Replace `<username>` and `<password>` with your database user credentials and append `/watchtrack` before `?`:
   ```
   mongodb+srv://watchtrack_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/watchtrack?retryWrites=true&w=majority
   ```
9. Paste this string into `MONGODB_URI` inside `.env.local`.

---

## Step 3: Get a Free TMDB API Key

1. Create a free account at [The Movie Database (TMDB)](https://www.themoviedb.org/signup).
2. Verify your email and log in.
3. Go to [TMDB API Settings](https://www.themoviedb.org/settings/api).
4. Click **Create** and choose **Developer**.
5. Accept the terms of use.
6. Fill in the short application:
   - Application Name: `WatchTrack`
   - Application URL: Your deployment URL or `http://localhost:3000`
   - Summary: "Personal private movie and TV show tracking application"
7. Copy your **API Key (v3 auth)** (32 characters).
8. Once logged into WatchTrack, paste it into **Settings &rarr; TMDB Key** (or the First-Run Setup modal).

---

## Step 4: Get a Free Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** in the top navigation.
4. Click **Create API key** (select "Create API key in new project").
5. Copy the generated key.
6. Paste it into **Settings &rarr; Google Gemini Key** in WatchTrack.

---

## Step 5: Set Up Brevo for Transactional Emails (Optional for local dev)

1. Sign up at [Brevo Free Registration](https://onboarding.brevo.com/account/register).
2. Confirm your email address.
3. Go to [Brevo SMTP & API Keys](https://app.brevo.com/settings/keys/api).
4. Click **Generate a new API key**, name it `WatchTrack`, and copy the key (`xkeysib-...`).
5. Go to [Senders & IP](https://app.brevo.com/senders) and ensure your registered email address is verified as a valid Sender.
6. Add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` to `.env.local`.

> **Note on Backup Codes**: If Brevo is unconfigured or in local development, WatchTrack issues **10 one-time recovery backup codes** (`XXXX-XXXX-XXXX`) directly on screen upon signup, which guarantee you can reset your password anytime even without email delivery!

---

## Step 6: Set Up Push Notifications (ntfy.sh)

1. Install the free **ntfy** app on your phone:
   - [ntfy for iOS (App Store)](https://apps.apple.com/us/app/ntfy/id1625396347)
   - [ntfy for Android (Google Play / F-Droid)](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - Or open the web app: [ntfy.sh](https://ntfy.sh)
2. In WatchTrack, go to **Settings (Profile)**.
3. Copy your unique, private **Notification Topic** (e.g. `watchtrack_usr_abcdef1234567890`).
4. In the ntfy app, tap **Subscribe to topic**, paste your topic, and tap **Subscribe**.
5. Tap the **Send Test Notification** button in WatchTrack Settings &mdash; your phone will buzz immediately with a test alert!

---

## Step 7: Deploy Free to Vercel

1. Push your repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Complete WatchTrack build"
   git push origin main
   ```
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME` = `watchtrack`
   - `MASTER_ENCRYPTION_KEY`
   - `SESSION_SECRET`
   - `CRON_SECRET`
   - `BREVO_API_KEY` (optional)
   - `BREVO_SENDER_EMAIL` (optional)
   - `BREVO_SENDER_NAME` = `WatchTrack`
   - `APP_URL` = your Vercel URL (e.g. `https://your-watchtrack.vercel.app`)
5. Click **Deploy**. Vercel will build and launch your production app in under 2 minutes.

---

## Step 8: Automated Weekly Backups (GitHub Actions)

In your GitHub repository:
1. Go to **Settings &rarr; Secrets and variables &rarr; Actions**.
2. Add Repository Secrets:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `MASTER_ENCRYPTION_KEY`: Your 64-character encryption key.
3. The workflow (`.github/workflows/backup.yml`) runs automatically every Sunday at 03:00 UTC, dumps the database, encrypts it with AES-256-CBC, and stores it as a private GitHub Actions artifact retained for 90 days.

---

## Testing & Verification Checklist: What to Test & What to Expect

Follow this step-by-step verification checklist to test all features:

### 1. Database Connection & Health Check
- **Action**: Visit `/api/health` in your browser.
- **Expected Result**: Returns `{ "status": "healthy", "mongodb": "connected", "database": "watchtrack" }` with HTTP 200.

### 2. User Signup & Recovery Codes
- **Action**: Go to `/signup`. Register a new account with your email and password.
- **Expected Result**:
  - Account is created with hashed password (`scrypt`).
  - You are presented with **10 one-time backup recovery codes** (`XXXX-XXXX-XXXX`).
  - A copy button lets you save them.
  - Revocable session cookie (`httpOnly`, `Secure`, `SameSite=Lax`) is set.
  - Redirects to Home dashboard with your private unguessable `ntfyTopic` assigned.

### 3. First-Run Setup & API Key Encryption
- **Action**: The First-Run Setup Modal appears on your first visit (or visit `/profile`). Paste your free TMDB API key.
- **Expected Result**:
  - Key is encrypted with AES-256-GCM using random IV and stored in MongoDB.
  - UI only displays masked preview (`••••••••••••1234`).
  - The plaintext key is NEVER exposed in API responses or HTML.

### 4. Search & Multi-Search Filtering
- **Action**: Go to `/search`.
  - Type "Inception" or "Breaking Bad".
  - Type "Batman 2022" to test year extraction.
  - Switch between All, Movies, and TV Series filter pills.
- **Expected Result**:
  - Input debounces ~300ms smoothly with loading spinner.
  - Stale keystrokes are cancelled cleanly via `AbortController`.
  - Results show posters, titles, year ranges, and one-tap "+ Want to Watch" buttons.
  - Tap "Bulk Select" to select multiple items and add them in one click.

### 5. Title Detail & Episode Progress Tracking
- **Action**: Tap on any TV series (e.g., *Breaking Bad*).
- **Expected Result**:
  - Detail page loads overview first with poster, backdrop, age rating, runtime, and next release date.
  - Tap season accordion (Season 1) to fetch episodes on demand.
  - Unaired episodes show their scheduled air date and cannot be marked.
  - Check off Episode 1:
    - Status immediately transitions from "Want to Watch" to "Currently Watching".
    - Stored in MongoDB as compact range `[[1, 1]]`.
  - Tap "Mark up to here" on Episode 5:
    - Episodes 1 through 5 are marked watched.
    - Stored in MongoDB as a single compact interval `[[1, 5]]`.
  - Tap "Mark Season Watched":
    - All aired episodes in the season are marked watched.
  - Season 0 specials sit in a collapsed section and do NOT affect series percentage.

### 6. "Continue Watching" Row (Home Screen)
- **Action**: Go to `/` (Home).
- **Expected Result**:
  - The series you started appears in the "Continue Watching" row showing the next unwatched episode card (e.g., `S1 E6`).
  - Tapping the green checkmark on the card instantly marks the episode watched without opening the page!

### 7. Ratings & Status Overrides
- **Action**: On any title detail page:
  - Tap star 4 or 5 to set a rating.
  - Select "On Hold" or "Dropped" from the status override dropdown.
- **Expected Result**:
  - Star rating is saved.
  - In `/lists`, the title shows an "On Hold" badge and is hidden from the active "Currently Watching" row.

### 8. Movie Franchise Bulk Actions
- **Action**: Search for a franchise movie (e.g. *Harry Potter and the Sorcerer's Stone*).
- **Expected Result**:
  - The detail page displays the Franchise Collection banner: "Part of the Harry Potter Collection".
  - Tapping "Mark whole collection as watched" tracks and marks all 8 movies in the franchise as watched idempotently!

### 9. Google Gemini AI Recommendations
- **Action**: Track/rate at least 3 titles. Go to `/recommendations` and tap "Get AI Recommendations".
- **Expected Result**:
  - Sends anonymized title list and star ratings to Gemini free tier.
  - Gemini returns structured recommendations.
  - Every returned TMDB ID is verified against TMDB API to prevent hallucinations.
  - Cards show poster, title, TMDB Verified badge, and AI reason.
  - Tap "+ Want to Watch" to instantly add recommendations to your watchlist.
  - A 2-minute cooldown timer prevents accidental API quota exhaustion.

### 10. Push Notifications & Daily Cron Job
- **Action**:
  - In `/profile`, tap "Send Test Notification". Verify push notification on your ntfy app.
  - In terminal or browser, test the daily cron route:
    ```bash
    curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/daily
    ```
- **Expected Result**:
  - Cron returns execution time, deduplicated series checked, and cleanups performed.
  - When new episodes air, it creates in-app notifications and sends ONE combined push per user.
  - Unverified accounts >7 days and read notifications >30 days are automatically pruned.

### 11. Data Export & Import (Offline JSON Backup)
- **Action**: Go to `/profile`.
  - Click "Export Library (JSON)".
  - Open the downloaded file to verify all tracked titles, ratings, and compact episode intervals are included (and passwords/keys are omitted).
  - Click "Import Library (JSON)" and select the file.
- **Expected Result**:
  - File is validated with Zod schema.
  - Data is merged idempotently with existing records without data loss.

### 12. PWA Standalone Installation & Offline Mode
- **Action**:
  - On iPhone Safari: Tap Share &rarr; "Add to Home Screen".
  - On Chrome / Android: Tap the Install icon in the address bar.
  - Disconnect your internet (or toggle Offline mode in DevTools Network tab).
- **Expected Result**:
  - App opens as a standalone full-screen window without browser address bars.
  - Service worker instantly serves cached app shell and lists.
  - Translucent Apple iOS offline banner appears: "Offline Mode &bull; Read-Only".
  - Write buttons are safely disabled in read-only mode.
