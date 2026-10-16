# WatchTrack — Manual Setup Guide

This guide contains **exact, numbered, step-by-step instructions** and direct links to create all required free accounts and obtain your API keys.

> **Zero Paid Services Guarantee**: Every service below operates on a **100% free tier** with **no credit card required**.

---

## Free-Tier Limits & Verification (Verified 2026 local audit)

| Service | Free Tier Allocation | Credit Card Required? | Notes / Safety Margins |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas** | 512 MB storage, 500 connections, ~100 ops/sec | ❌ No | Reuses 1 cached connection pool (`maxPoolSize: 10`) |
| **Vercel** | 100 GB bandwidth, Serverless functions, 1 Cron job | ❌ No | Cron executes once daily via protected GET route |
| **TMDB API** | Free non-commercial developer access (~40 req/10s) | ❌ No | Shared metadata cached with MongoDB TTL |
| **Google Gemini API** | Free tier (15 RPM, 1,500 requests/day on Flash models) | ❌ No | Only invoked on-demand when tapping "Get Recommendations" |
| **Brevo** | 300 emails/day (9,000/month) | ❌ No | Transactional email for verification & resets |
| **ntfy.sh** | Unlimited public server pushes | ❌ No | Zero signup; uses long random private topic per user |
| **GitHub Actions** | 2,000 free runner minutes/month | ❌ No | Runs CI lint, type check, tests, and build |

---

## Step 1: Generate Cryptographic Secrets

Before configuring services, generate the required master encryption key and session secrets on your terminal.

Run the following commands in your shell:

```bash
# 1. Generate 32-byte (64-character hex) Master Encryption Key for AES-256-GCM
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Generate 32-byte Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Generate Daily Cron Bearer Secret
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Save these values securely:
- `MASTER_ENCRYPTION_KEY`: 64-character hex string (used to encrypt user TMDB and Gemini keys at rest)
- `SESSION_SECRET`: 64-character string (used to sign session cookies and integrity hashes)
- `CRON_SECRET`: 48-character string (sent in `Authorization: Bearer <token>` by Vercel Cron)

---

## Step 2: Set Up MongoDB Atlas Free Cluster (M0)

1. Navigate to [MongoDB Atlas Registration](https://www.mongodb.com/cloud/atlas/register).
2. Sign up with email or GitHub. No credit card required.
3. In the setup wizard, select **M0 Free** (512 MB Storage).
4. Choose your preferred cloud provider (AWS, GCP, or Azure) and closest region.
5. Under **Security Quickstart**:
   - **Database User**: Create a username (e.g. `watchtrack_user`) and a secure password. Note these down.
   - **Network Access**: Add IP Address `0.0.0.0/0` (Allow access from anywhere) so Vercel serverless functions can connect.
6. Click **Database** in the sidebar, click **Connect**, select **Drivers** (Node.js).
7. Copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
8. Replace `<password>` with your database user password and append `/watchtrack` before the query string:
   ```
   mongodb+srv://watchtrack_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/watchtrack?retryWrites=true&w=majority
   ```

---

## Step 3: Get a Free TMDB API Key

Every user enters their own TMDB key directly into WatchTrack settings:

1. Create a free account at [The Movie Database (TMDB)](https://www.themoviedb.org/signup).
2. Verify your email and log in.
3. Go to [TMDB API Settings](https://www.themoviedb.org/settings/api).
4. Click **Create** and choose **Developer**.
5. Accept the terms of use.
6. Fill in the application form:
   - Application Name: `WatchTrack`
   - Application URL: Your deployment URL or `http://localhost:3000`
   - Summary: "Personal private movie and TV show tracking application"
7. Copy your **API Key (v3 auth)** or **API Read Access Token (v4 auth)**.

---

## Step 4: Get a Free Google Gemini API Key

1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** in the top navigation.
4. Click **Create API key** (select "Create API key in new project").
5. Copy the generated key.
6. The key uses the free tier (15 requests/minute, 1,500 requests/day, zero credit card required).

---

## Step 5: Set Up Brevo for Free Transactional Emails

1. Sign up at [Brevo Free Registration](https://onboarding.brevo.com/account/register). No credit card required.
2. Confirm your email address and complete profile setup.
3. Go to [Brevo SMTP & API Keys](https://app.brevo.com/settings/keys/api).
4. Click **Generate a new API key**.
5. Name it `WatchTrack` and copy the API key (`xkeysib-...`).
6. Go to [Senders & IP](https://app.brevo.com/senders) and ensure your registered email address is verified as a valid Sender.

> **Deliverability note**: Emails sent from free domains (e.g. `@gmail.com`) through Brevo may land in Spam folders. WatchTrack includes **8-10 one-time recovery backup codes** generated at signup as a guaranteed fallback to reset passwords even without email.

---

## Step 6: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
cp .env.example .env.local
```

Fill in the values:

```env
# Runtime Environment
NODE_ENV=development
APP_URL=http://localhost:3000

# MongoDB Atlas Free Tier
MONGODB_URI=mongodb+srv://watchtrack_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/watchtrack?retryWrites=true&w=majority
MONGODB_DB_NAME=watchtrack

# Security Secrets (Generated in Step 1)
MASTER_ENCRYPTION_KEY=your_64_character_hex_master_key_here
SESSION_SECRET=your_minimum_32_character_session_secret_here
CRON_SECRET=your_minimum_16_character_cron_secret_here

# Brevo Transactional Email (Phase 2+)
BREVO_API_KEY=xkeysib-your_brevo_api_key_here
BREVO_SENDER_EMAIL=your_verified_brevo_sender@domain.com
BREVO_SENDER_NAME=WatchTrack
```

---

## Step 7: Deploy Free to Vercel

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `MASTER_ENCRYPTION_KEY`
   - `SESSION_SECRET`
   - `CRON_SECRET`
   - `BREVO_API_KEY`
   - `BREVO_SENDER_EMAIL`
   - `BREVO_SENDER_NAME`
   - `APP_URL` (set to your Vercel deployment URL, e.g. `https://your-app.vercel.app`)
5. Click **Deploy**.
6. The app is live on Vercel's free tier with zero server costs!

