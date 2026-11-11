# Splitlyst

> Split bills, track shared expenses, and settle up with friends and groups — all in one place.

A full-featured, open-source Splitwise alternative built with Next.js 16, PostgreSQL, and Prisma. Installable as a Progressive Web App (PWA) and deployable to Vercel in minutes.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Local)](#quick-start-local)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Running the App](#running-the-app)
8. [Testing Connections](#testing-connections)
9. [Tests & Code Quality](#tests--code-quality)
10. [Deploy to Vercel](#deploy-to-vercel)
11. [PWA Installation](#pwa-installation)
12. [Project Structure](#project-structure)
13. [API Reference](#api-reference)
14. [Split Types Explained](#split-types-explained)
15. [Balance Algorithm](#balance-algorithm)
16. [Demo Accounts](#demo-accounts)
17. [Troubleshooting](#troubleshooting)
18. [Upgrade Notes](#upgrade-notes)

---

## Features

Everything is free — there are no paid tiers, expense caps, or ads.

### Accounts & security

| Feature                | Description                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Auth**               | Email + password signup/login with JWT sessions (30-day expiry)                                     |
| **Google sign-in**     | Optional "Continue with Google" (enabled when `GOOGLE_CLIENT_ID/SECRET` are set)                    |
| **Email verification** | Verification link emailed on sign-up; banner + "Resend" until verified (non-blocking)               |
| **Two-factor auth**    | TOTP (Google Authenticator, Authy, 1Password…) with QR setup and 8 single-use recovery codes        |
| **Password reset**     | Reset link is **emailed** (Resend). Without email configured, the link is only shown in local dev   |
| **Rate limiting**      | Register, forgot-password, reset-password and reminders are rate limited (in-memory, per IP / pair) |
| **Account deletion**   | Password-confirmed; personal data removed, shared history anonymised as "Deleted user"              |
| **Profile**            | Avatar (Cloudinary), phone, bio, timezone, default currency, change password                        |
| **Payment handles**    | Optional Venmo / PayPal.me / UPI ID shown to friends who owe you                                    |
| **Languages**          | English, Español, Français, Deutsch, हिन्दी — navigation and key labels (Settings → Preferences)    |

### Friends & groups

| Feature             | Description                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Friend requests** | Send by email → recipient accepts or declines; sent requests can be cancelled                                                                                                                                             |
| **Groups**          | Create, edit, delete; add members by email; admin role                                                                                                                                                                    |
| **Invite links**    | Admins copy / revoke a `/join/<code>` link; anyone logged in can join                                                                                                                                                     |
| **Leave group**     | Blocked while you have unsettled balances or if you are the last admin of others                                                                                                                                          |
| **Simplify debts**  | Per-group toggle: minimum-payment suggestions, or the plain "who owes whom" list                                                                                                                                          |
| **Default split**   | Per-group default (equal / percentage / shares) that pre-fills new expenses                                                                                                                                               |
| **Archive groups**  | Archive hides a group and blocks new expenses; restore from the **Archived** tab                                                                                                                                          |
| **Import**          | Import a Splitwise CSV export into a group: preview first, then one atomic bulk insert (up to 5,000 rows). Handles US `M/D/YY` dates, "Payment" and "Settle all balances" rows, and groups with more people than the file |

### Expenses & money

| Feature              | Description                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Expenses**         | Add, edit, delete with description, date, category, notes                                                                                                                      |
| **Itemised splits**  | Add line items, assign each to people, and share tax & tip in proportion to what was ordered                                                                                   |
| **Split types**      | Equal · Percentage · Shares · Custom amounts                                                                                                                                   |
| **Receipts**         | Attach a receipt image to an expense; shown on the expense page                                                                                                                |
| **Recurring**        | "Repeat this expense" (daily/weekly/monthly/yearly); a daily cron creates the copies                                                                                           |
| **Currency display** | Every amount shows its own symbol; foreign amounts also show "≈ …" in your preferred currency                                                                                  |
| **Multi-currency**   | 20+ currencies with live conversion to your preferred currency                                                                                                                 |
| **Balances**         | Real-time balances across groups and friends                                                                                                                                   |
| **Smart settle-up**  | Minimum-transaction debt simplification                                                                                                                                        |
| **AI Agent**         | Describe an expense in plain English → the agent _proposes_ it (nothing saved until you confirm). Runs on open-weight models through Otari, with a per-user daily AI allowance |
| **Activity feed**    | Grouped by day with filters; shows who did what, amounts, and your effect ("you lent" / "you owe")                                                                             |
| **Payments**         | Calculated, not typed: the amount is the outstanding balance (read-only) and the server rejects anything above it; either person can record it; full **Payments** history page |
| **Pay links**        | Venmo / PayPal / UPI deep links when you owe a friend who saved a handle                                                                                                       |
| **Reminders**        | Nudge someone who owes you (in-app + email; 1 per person per hour)                                                                                                             |
| **Comments**         | Per-expense comment threads                                                                                                                                                    |
| **Search & filter**  | Filter expenses by keyword and category                                                                                                                                        |
| **Analytics**        | Monthly spending, category breakdown, trends (Recharts)                                                                                                                        |
| **Offline entry**    | Expenses added without a connection are saved on the device and synced when you're back online                                                                                 |
| **Export**           | Download expenses as CSV or JSON, optionally for a date range                                                                                                                  |

### Notifications

| Feature      | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| **In-app**   | Expenses, payments, friend requests, reminders, activity feed                            |
| **Email**    | New-expense and reminder emails when `RESEND_API_KEY` + `EMAIL_FROM` are set             |
| **Web push** | Optional push notifications on each device (VAPID keys required; Settings → Preferences) |
| **PWA**      | Installable on iOS/Android; static assets cached                                         |

### Not built (yet) — compared with Splitwise

Splitlyst covers the day-to-day core of Splitwise, including several of its paid features, but it is not a
byte-for-byte clone. Known gaps:

- **Native iOS/Android apps** — it's an installable PWA instead.
- **Editing an expense in the UI** — the API supports it (`PATCH /api/expenses/:id`) but there is no edit screen yet; delete and re-add.
- **Group settings screen** — renaming a group / changing its currency or avatar, and promoting/demoting admins, are API-only or missing.
- **People without an account** — friends and group members must already be registered; there are no email invites or placeholder members.
- **Partial payments** — the settle-up amount is calculated and fixed to the full outstanding balance.
- **Separate balances per currency** — amounts are converted into one currency instead of tracked per currency.
- **Receipt OCR / auto-itemising**, **bank transaction import** and **in-app payments** (Venmo/PayPal/UPI are deep links only).
- **Email change**, **comment edit/delete**, **notification preferences** (which emails/pushes you want), and **real-time sync** between devices.

---

## AI Agent (Otari)

The `/agent` page turns a sentence like _"Dinner 3200 with Priya and Amit, I paid"_ into a proposed expense.
The agent **never saves anything on its own**: you review the proposal (payer, people, per-person shares) and
press **Confirm**, which uses the normal, fully validated expense endpoint.

**The two-model flow**

1. **Reader** (fast, ~2 s) → proposal appears immediately, shares computed by the server.
2. **Planner** (stronger, ~14 s, ~$0.01) → re-computes the split by running Python through Otari's code tool.
   The result is compared in whole cents with the server's own maths: ✅ _verified_, ⚠️ _mismatch_
   (the server's numbers are still what gets saved) or _unverified/unavailable_. It never blocks confirming, and
   "verified" is only shown if Otari reports that code actually ran.
3. The Python is fixed (integer cents) rather than model-written: a live run showed the model's own code was
   wrong for 3200 ÷ 3. A differential test checks the Python against the TypeScript on 150 random splits.

**How it is wired**

```text
Browser ──► POST /api/agent/propose ──► lib/otari.ts ──► Otari gateway ──► open-weight model
              │  name → user-id matching          (one OpenAI-compatible endpoint, per-user billing)
              │  server-side split arithmetic
              ▼
        Proposal card + "What happened (Otari)" inspector ──► Confirm ──► POST /api/expenses
```

- The model never supplies user ids: it returns names, and the server matches them to people the user is
  allowed to use (the group's members, or you + accepted friends). Unknown names are flagged, never guessed.
- The split amounts that get saved are computed by the server, not the model.
- Every call is sent with the Splitlyst user id in the `user` field, so Otari bills each person against their
  **own** daily budget. When it runs out they see a friendly message and the allowance meter shows the reset time.
- The inspector under each answer shows the model that actually answered, whether a backup was used, tokens/cost,
  tools run and guardrail verdicts.

**Models** (all open-weight, verified live on the account; override with `OTARI_MODEL_<ROLE>`)

| Role    | Model                                                                 | Why                                                                                                                        |
| ------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Reader  | `alibaba/qwen3-30b-a3b-instruct-2507`                                 | ~2 s and cheapest of the non-reasoning candidates; `gpt-oss-120b` took 5–25 s and could run out of tokens while "thinking" |
| Planner | routing policy `splitlyst-agent` (Qwen3-235B → backup `z-ai/glm-4.7`) | Fallback happens inside Otari                                                                                              |
| Vision  | `alibaba/qwen3-vl-30b-a3b-instruct`                                   | Receipt reading (planned)                                                                                                  |

**Setup (hosted otari.ai)**

1. Create a budget (e.g. **$0.10 / day**) in _Spend & budgets_.
2. _API keys → Create key → Advanced → Service key_; pick that budget as the end-user budget.
3. Put the key in `.env` as `OTARI_API_KEY` and set `OTARI_DAILY_BUDGET_USD` to match.
4. (Optional) _Routing → Policies → Fallback_ named `splitlyst-agent`.

**Testing it**

```bash
npm run otari:smoke   # live: real model, 4 sentences, a few fractions of a cent
npm test              # unit/route tests (gateway mocked)
npm run test:e2e      # browser tests run against scripts/fake-otari.mjs — no real calls, no cost
```

**Contest rubric status (MozFest Developers Wilding)** — updated as features land:

| Otari capability                               | Status in the app                                                                                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-weight models (2+ for different purposes) | ✅ Reader (Qwen3-30B) and planner (Qwen3-235B via policy, GLM-4.7 backup) both run in the app; vision is planned                                                        |
| Per-user budgets                               | ✅ `user` field per request, allowance meter, friendly refusal                                                                                                          |
| Budgets and spending limits                    | ✅ per-user daily limit handled end to end; workspace ceiling is set in the Otari dashboard                                                                             |
| Model routing and fallbacks                    | ✅ The planner is always called through the `splitlyst-agent` policy; the inspector shows the answering model and a "backup model used" badge (`Otari-Fallback` header) |
| Code execution                                 | ✅ The planner runs a fixed Python snippet in Otari's sandbox to re-compute every split; the card shows a verified / mismatch badge                                     |
| Web search / fetch                             | 🚧 planned (live exchange rates)                                                                                                                                        |
| MCP integrations                               | 🚧 planned                                                                                                                                                              |
| Guardrails                                     | 🚧 planned                                                                                                                                                              |

---

## Tech Stack

| Layer         | Technology                                 | Version    |
| ------------- | ------------------------------------------ | ---------- |
| Framework     | [Next.js](https://nextjs.org) (App Router) | **16.x**   |
| Language      | TypeScript                                 | 5.8+       |
| UI            | React                                      | 19.x       |
| Styling       | Tailwind CSS                               | **4.x**    |
| Database ORM  | Prisma                                     | **7.x**    |
| Database      | PostgreSQL (via Supabase)                  | 14+        |
| DB Driver     | `@prisma/adapter-pg` + `pg`                | —          |
| Auth          | NextAuth.js (JWT)                          | 4.x        |
| Data Fetching | TanStack Query                             | 5.x        |
| Forms         | React Hook Form + Zod                      | 7.x / 3.x  |
| Charts        | Recharts                                   | 2.x        |
| Icons         | Lucide React                               | 0.5xx      |
| Node.js       | LTS                                        | **24.x**   |
| Formatter     | Prettier + prettier-plugin-tailwindcss     | 3.x        |
| Linter        | ESLint (flat config)                       | **10.x**   |
| Git hooks     | Husky + lint-staged                        | 9.x / 15.x |

---

## Prerequisites

### Node.js 24 (required)

The project requires **Node.js 24**. Use [nvm](https://github.com/nvm-sh/nvm) to manage versions:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node 24 (reads .nvmrc automatically)
nvm install 24
nvm use
```

Verify:

```bash
node --version   # v24.x.x
npm --version    # 11.x.x
```

### PostgreSQL

Any of these work — pick one:

| Option             | Notes                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| **Supabase** ⭐    | Free tier, works perfectly with Vercel. [supabase.com](https://supabase.com) |
| **Neon**           | Serverless Postgres, great for Vercel Edge. [neon.tech](https://neon.tech)   |
| **Railway**        | Easy setup, generous free tier. [railway.app](https://railway.app)           |
| **Local Docker**   | `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16`              |
| **Local Postgres** | Install via Homebrew: `brew install postgresql@16`                           |

---

## Quick Start (Local)

```bash
# 1. Use correct Node version
nvm use   # reads .nvmrc → Node 24

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# → edit .env with your DATABASE_URL and NEXTAUTH_SECRET (see below)

# 4. Generate Prisma client
npx prisma generate

# 5. Push schema to database
npm run db:push

# 6. (Optional) Seed with demo data
npm run db:seed

# 7. Generate PWA icons
npm run icons

# 8. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                                             | Required | Description                                                                                     |
| ---------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       |    ✅    | PostgreSQL connection string                                                                    |
| `NEXTAUTH_SECRET`                                    |    ✅    | Random string ≥ 32 characters for JWT signing                                                   |
| `NEXTAUTH_URL`                                       |    ✅    | Full base URL of the app (e.g. `http://localhost:3000`)                                         |
| `EXCHANGE_RATE_API_KEY`                              |    ❌    | Free key from [exchangerate-api.com](https://www.exchangerate-api.com/) for live FX rates       |
| `NEXT_PUBLIC_APP_URL`                                |    ❌    | Same as `NEXTAUTH_URL` — used in OpenGraph metadata                                             |
| `CLOUDINARY_CLOUD_NAME`                              |    ❌    | Cloudinary cloud name for avatar uploads                                                        |
| `CLOUDINARY_API_KEY`                                 |    ❌    | Cloudinary API key                                                                              |
| `CLOUDINARY_API_SECRET`                              |    ❌    | Cloudinary API secret                                                                           |
| `DIRECT_URL`                                         |    ❌    | Non-pooled DB URL — use it for `prisma db push` when `DATABASE_URL` is a pgbouncer pooler       |
| `RESEND_API_KEY`                                     |    ❌    | [Resend](https://resend.com) key — enables password-reset, expense and reminder emails          |
| `EMAIL_FROM`                                         |    ❌    | Sender, e.g. `Splitlyst <noreply@yourdomain.com>` (must be a verified Resend sender)            |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |    ❌    | Web push keys — generate with `npx web-push generate-vapid-keys`                                |
| `VAPID_SUBJECT`                                      |    ❌    | `mailto:` contact for push services, e.g. `mailto:you@yourdomain.com`                           |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`          |    ❌    | Enables Google sign-in. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`                 |
| `OTARI_API_KEY`                                      |    ❌    | [Otari](https://otari.ai) **service key** (`otk_…`) — enables the AI Agent (hidden when unset)  |
| `OTARI_DAILY_BUDGET_USD`                             |    ❌    | Per-user daily AI budget shown in the allowance meter (match your Otari budget; default `0.10`) |
| `CRON_SECRET`                                        |   ✅\*   | Secret for `/api/cron/recurring`. \*Required for recurring expenses to run                      |

### Generate a strong secret

```bash
openssl rand -base64 32
```

### Example `.env`

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/splitlyst"
NEXTAUTH_SECRET="abc123...your-32+-char-random-string"
NEXTAUTH_URL="http://localhost:3000"
CRON_SECRET="any-long-random-string"
# Optional: RESEND_API_KEY / EMAIL_FROM for email, DIRECT_URL for migrations behind a pooler
```

---

## Database Setup

### Prisma v7 configuration

Prisma v7 moves datasource config out of `schema.prisma` and into `prisma.config.ts`. The `.env` file is loaded by the config file itself using Node's built-in `process.loadEnvFile()` — no `dotenv` package required.

`prisma.config.ts`:

```typescript
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile('.env');
} catch {}

export default defineConfig({
  datasource: { url: process.env.DATABASE_URL },
});
```

`prisma/schema.prisma` has no URL — it's fully managed by the config file.

### 1. Generate Prisma client

```bash
npx prisma generate
```

This is run automatically on `npm install` via the `postinstall` script, and before every `npm run build`.

### 2. Push schema (development / first deploy)

```bash
npm run db:push
```

Prisma introspects `prisma/schema.prisma` and creates all tables without writing a migration file. Use this for local dev and initial deploys.

### 3. Run migrations (production workflow)

```bash
npm run db:migrate
# prompts for a migration name
```

This creates a versioned SQL file in `prisma/migrations/` and applies it. Commit this file to source control.

### 4. Open Prisma Studio (GUI browser for your data)

```bash
npm run db:studio
# → opens http://localhost:5555
```

> **Note:** Prisma Studio has a known compatibility issue with Node.js v22+. If it crashes with `ERR_STREAM_UNABLE_TO_PIPE`, run it with an older Node version: `nvm exec 20 npx prisma studio`

### 5. Seed demo data

```bash
npm run db:seed
```

Creates three demo users (see [Demo Accounts](#demo-accounts)), a shared group, and sample expenses.

### Schema overview

```
User          ←─── GroupMember ───→ Group
User          ←─── ExpenseSplit ──→ Expense
User (payer)  ←─── Expense
User          ←─── Payment ──────→ User (receiver)
User          ←─── Friendship ───→ User
User          ←─── Notification
User          ←─── Activity ─────→ Group?, Expense?
Expense       ←─── Comment
Expense       ←─── Attachment
User          ←─── RecurringTemplate
```

---

## Running the App

```bash
# Development (Turbopack — fast HMR)
npm run dev

# Production build
npm run build
npm run start

# Lint
npm run lint
npm run lint:fix   # auto-fix lint issues

# Format
npm run format          # write changes in-place
npm run format:check    # CI mode — exits non-zero if any file differs
```

---

## Testing Connections

Before starting the app, verify that your database and exchange rate API are reachable:

```bash
npm run test:connections
```

Expected output:

```
Splitlyst — connection tests

1 · Database (PostgreSQL via Prisma)
  ·  URL: postgresql://...
  ✓  Connected  (Xms)
  ✓  Tables reachable — users: 0, groups: 0, expenses: 0

2 · Exchange Rate API (exchangerate-api.com)
  ·  Key: 068f67**...
  ✓  Connected  (Xms)
  ✓  Base currency: USD
  ✓  Sample rates: EUR=0.87  GBP=0.75  JPY=161  INR=94  CAD=1.42

Summary
  ✓  Database
  ✓  Exchange Rate API
```

- If `DATABASE_URL` is wrong, the DB check fails with the exact error.
- If `EXCHANGE_RATE_API_KEY` is missing, the API check is skipped and the app falls back to hardcoded rates — this is fine for local dev.

---

## Tests & Code Quality

### Unit and API tests

```bash
npm test              # Jest — 123 tests (logic + API routes with mocked Prisma/auth)
npm run test:watch
```

Route tests mock `@/lib/prisma` and `@/lib/auth`, so they need no database. Covered: split/balance
math (incl. itemised tax/tip), TOTP (RFC 6238 vectors), rate limiting, email sending, i18n
completeness, Splitwise CSV import, offline queue (incl. concurrent flush), the recurring-expense
cron, friend requests, invite links and reminders.

### End-to-end tests (real browser)

32 Playwright tests drive Chromium against a **production build** of the app and the database in
your `.env` (it creates throw-away users with `@e2e.test` emails; email is disabled for the run so
nothing is sent).

```bash
npx playwright install chromium   # once
npm run test:e2e                  # builds the app, starts it on :3100, runs the suite
npx playwright show-report        # open the HTML report (screenshots/videos/traces on failure)
```

They cover registration, email verification, password reset, 2FA (including recovery codes),
friend requests, groups, equal and itemised expenses, balances, reminders, settle-up, leaving a group,
invite links, archiving, group settings, receipts, offline sync, recurring cron, Splitwise import,
export, push subscriptions, language, payment links and account deletion.

> E2E uses your real `DATABASE_URL`. Point it at a test database, not production.

### Lint, format, types and build

```bash
npm run lint          # ESLint
npm run format:check  # Prettier (use `npm run format` to fix)
npx tsc --noEmit      # Type check
npm run build         # Production build
```

The project uses **Prettier**, **ESLint**, and **Husky** to keep code consistently formatted and error-free from the first commit.

### Prettier

[Prettier](https://prettier.io) enforces a single code style across TypeScript, JSON, CSS, and Markdown. Key settings (`prettier.config.mjs`):

| Setting         | Value                         | Reason                                            |
| --------------- | ----------------------------- | ------------------------------------------------- |
| `printWidth`    | 100                           | Wider than 80, readable on modern screens         |
| `singleQuote`   | `true`                        | Industry convention for JS/TS                     |
| `semi`          | `false`                       | Cleaner output; ASI covers everything needed      |
| `trailingComma` | `'es5'`                       | Cleaner diffs; valid in all ES5+ environments     |
| `endOfLine`     | `'lf'`                        | Unix line endings; avoids CRLF noise in git diffs |
| Plugin          | `prettier-plugin-tailwindcss` | Auto-sorts Tailwind class names                   |

Run format manually:

```bash
npm run format          # format all files in-place
npm run format:check    # check without writing (used in CI)
```

### ESLint

ESLint uses the **flat config** format (`eslint.config.mjs`) with ESLint 10. The config extends:

- `next/core-web-vitals` — Next.js recommended rules
- `next/typescript` — TypeScript-specific rules
- `prettier` — disables all ESLint rules that conflict with Prettier (via `eslint-config-prettier`)

No `FlatCompat` wrapper needed — `eslint-config-next` v16 exports native flat config arrays.

```bash
npm run lint        # report issues
npm run lint:fix    # auto-fix where possible
```

### Husky + lint-staged

[Husky](https://typicode.github.io/husky/) registers a **pre-commit** git hook. Every time you `git commit`, [lint-staged](https://github.com/lint-staged/lint-staged) runs Prettier and ESLint **only on the files you staged** — fast feedback, zero noise.

> **First-time setup:** Husky hooks are installed automatically when you run `npm install` because the `prepare` script runs `husky`. No manual step needed.

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Follow the prompts. Vercel auto-detects Next.js.

### Option B — GitHub Integration

1. Push the repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import repository
3. Vercel builds and deploys automatically on every push

### Set environment variables

In the Vercel dashboard → Project → Settings → Environment Variables, add:

```
DATABASE_URL        = <your Supabase/Neon/Railway connection string>
NEXTAUTH_SECRET     = <your 32+ char secret>
NEXTAUTH_URL        = https://your-app.vercel.app
CRON_SECRET         = <long random string>   # Vercel sends it as "Bearer ..." to the cron route
RESEND_API_KEY      = <optional, enables email>
EMAIL_FROM          = <optional, e.g. Splitlyst <noreply@yourdomain.com>>
```

`vercel.json` registers a daily cron (`0 6 * * *` UTC) for `/api/cron/recurring`. Cron jobs run only
on production deployments. To trigger it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/recurring
```

> Use the **"Direct connection"** (not pooled) string from Supabase for `prisma db push`.
> For production app traffic, use the **pooled** connection string.

### After first deploy — push schema

```bash
# Pull production env vars locally
vercel env pull .env.production.local

# Push schema to production DB
DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2-) npx prisma db push
```

---

## PWA Installation

Splitlyst is a full Progressive Web App.

### Android (Chrome)

1. Open the app in Chrome
2. Tap the **⋮** menu → **"Add to Home screen"**
3. Confirm — the app icon appears on your home screen

### iOS (Safari)

1. Open the app in Safari
2. Tap the **Share** button (box with arrow)
3. Scroll down → **"Add to Home Screen"**
4. Tap **Add**

### Desktop (Chrome / Edge)

1. Look for the install icon (⊕) in the address bar
2. Click **Install Splitlyst**

### Offline support

The service worker (`public/sw.js`) caches:

- All visited pages (network-first, falls back to cache)
- Static assets: JS, CSS, images (cache-first)
- API errors return `{ offline: true }` when no network

---

## Project Structure

```
splitlyst/
├── app/
│   ├── (auth)/                   # Unauthenticated routes
│   │   ├── login/
│   │   │   ├── page.tsx          # Server component — wraps LoginForm in Suspense
│   │   │   └── LoginForm.tsx     # Client component — sign-in form
│   │   ├── reset-password/
│   │   │   ├── page.tsx          # Server component — wraps ResetPasswordForm in Suspense
│   │   │   └── ResetPasswordForm.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/              # Protected app routes
│   │   ├── layout.tsx            # Sidebar + mobile nav wrapper
│   │   ├── dashboard/page.tsx    # Balance overview + quick actions
│   │   ├── groups/
│   │   │   ├── page.tsx          # Group list
│   │   │   ├── new/page.tsx      # Create group form
│   │   │   └── [id]/page.tsx     # Group detail + expenses + balances
│   │   ├── friends/page.tsx      # Friend list + balances
│   │   ├── expenses/
│   │   │   ├── page.tsx          # All expenses (searchable/filterable)
│   │   │   ├── new/
│   │   │   │   ├── page.tsx      # Server component — wraps form in Suspense
│   │   │   │   └── NewExpenseForm.tsx  # Client component — full expense form
│   │   │   └── [id]/page.tsx     # Expense detail + comments
│   │   ├── activity/page.tsx     # Activity feed + notifications
│   │   ├── analytics/page.tsx    # Charts
│   │   ├── payments/page.tsx     # Payment history
│   │   ├── join/[code]/page.tsx  # Join a group via invite link
│   │   └── settings/page.tsx     # Profile, security, preferences
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/    # NextAuth handler
│   │   │   ├── register/        # POST /api/auth/register
│   │   │   ├── forgot-password/ # POST — send reset email
│   │   ├── verify-email/    # GET confirm link · POST resend
│   │   │   └── reset-password/  # POST — apply new password
│   │   ├── groups/              # CRUD, members, invite links, join, archive
│   │   ├── import/              # Splitwise CSV import
│   │   ├── reminders/           # Settle-up reminders
│   │   ├── push/                # Web-push subscribe / unsubscribe / config
│   │   ├── cron/recurring/      # Daily recurring-expense job (CRON_SECRET)
│   │   ├── expenses/            # CRUD + comments
│   │   ├── payments/            # Record payments
│   │   ├── friends/             # Friend requests (send/accept/remove)
│   │   ├── balances/            # Computed balances with currency conversion
│   │   ├── activity/            # Activity log
│   │   ├── notifications/       # Read/mark-read
│   │   ├── analytics/           # Spending stats (server-computed)
│   │   ├── currency/            # FX rate lookup
│   │   ├── export/              # CSV / JSON download
│   │   ├── upload/              # Avatar + receipt upload → Cloudinary
│   │   └── users/me/            # Profile CRUD, password change, account deletion, 2fa/
│   ├── globals.css              # Tailwind v4 @theme config + custom component classes
│   ├── layout.tsx               # Root layout + PWA meta + SW registration
│   └── page.tsx                 # Public landing page
│
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx          # Desktop sidebar navigation
│   │   ├── mobile-nav.tsx       # Mobile bottom tab bar
│   │   └── header.tsx           # Mobile top header
│   ├── ui/
│   │   ├── avatar.tsx           # Avatar + AvatarGroup (next/image with custom loader)
│   │   ├── dropdown.tsx         # Accessible dropdown menu
│   │   ├── empty-state.tsx      # Empty state placeholder
│   │   ├── loading.tsx          # Spinner + skeleton loaders
│   │   ├── modal.tsx            # Modal + ConfirmModal
│   │   └── toaster.tsx          # Zero-dependency toast system
│   ├── settings/                # TwoFactorCard, PushToggle
│   └── providers.tsx            # SessionProvider + QueryClientProvider + offline sync
│
├── lib/
│   ├── auth.ts                  # NextAuth options (JWT, credentials, currency in token)
│   ├── calculations.ts          # Split logic + debt simplification
│   ├── currency.ts              # Exchange rate fetch + convertAmount()
│   ├── email.ts                 # Resend email sender (no-op when unconfigured)
│   ├── i18n.ts / use-t.ts       # Translations + `useT()` hook (en, es, fr, de, hi)
│   ├── notify.ts / push.ts      # In-app notification + web-push fan-out
│   ├── offline-queue.ts         # Offline expense queue (localStorage, synced on reconnect)
│   ├── totp.ts                  # RFC 6238 TOTP + recovery codes
│   ├── verification.ts          # Email-verification tokens
│   ├── group-balance.ts         # Net balance of a user in a group (leave-group check)
│   ├── rate-limit.ts            # In-memory sliding-window rate limiter
│   ├── splitwise-import.ts      # Splitwise CSV parser + import planner
│   ├── prisma.ts                # Singleton Prisma client (PrismaPg adapter)
│   └── utils.ts                 # cn(), formatCurrency, formatDate, …
│
├── prisma/
│   ├── schema.prisma            # Database schema (16 models, no URL — see prisma.config.ts)
│   └── seed.ts                  # Demo data seeder (uses PrismaPg adapter)
│
├── prisma.config.ts             # Prisma v7 config — loads .env, sets datasource URL
│
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker (cache strategies)
│   └── icons/                   # PWA icons (generated by scripts/generate-icons.js)
│
├── scripts/
│   ├── generate-icons.js        # SVG → PNG icon generator
│   └── test-connections.ts      # Verify DB + exchange rate API are reachable
│
├── e2e/                         # Playwright browser tests (auth, money, security, features)
├── playwright.config.ts         # Builds + serves the app on :3100 for E2E
│
├── __tests__/
│   ├── lib/                     # Unit tests (calculations, utils, email, rate-limit, import, …)
│   └── api/                     # Route tests with mocked Prisma/auth
│
├── types/
│   └── index.ts                 # Shared TypeScript types + CURRENCIES constant
│
├── proxy.ts                     # Next.js 16 middleware (auth route protection)
├── .env.example                 # Template for environment variables
├── .nvmrc                       # Node.js version pin (24)
├── eslint.config.mjs            # ESLint 10 native flat config
├── prettier.config.mjs          # Prettier config + tailwindcss plugin
├── next.config.ts               # Next.js config (image remotePatterns)
├── tsconfig.json                # TypeScript strict mode
└── vercel.json                  # Vercel deployment config
```

---

## API Reference

All API routes are under `/api`. All protected routes require a valid session cookie (set automatically by NextAuth).

### Auth

| Method | Route                           | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| `POST` | `/api/auth/register`            | Create account `{ name, email, password }` |
| `POST` | `/api/auth/[...nextauth]`       | NextAuth sign-in / sign-out / session      |
| `POST` | `/api/auth/forgot-password`     | Send password reset email `{ email }`      |
| `GET`  | `/api/auth/verify-email?token=` | Confirm email from the emailed link        |
| `POST` | `/api/auth/verify-email`        | Resend verification email (signed in)      |
| `POST` | `/api/auth/reset-password`      | Apply new password `{ token, password }`   |

### Groups

| Method   | Route                     | Description                                                              |
| -------- | ------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/groups`             | List groups for current user (`?archived=true` for archived)             |
| `POST`   | `/api/groups`             | Create group `{ name, description?, currency, category, memberEmails? }` |
| `GET`    | `/api/groups/:id`         | Group detail with members, expenses, counts                              |
| `PATCH`  | `/api/groups/:id`         | Update group, `simplifyDebts`, `defaultSplit`, `isArchived` (admin only) |
| `DELETE` | `/api/groups/:id`         | Delete group (admin only)                                                |
| `POST`   | `/api/groups/:id/members` | Add member by email (admin only)                                         |
| `DELETE` | `/api/groups/:id/members` | Remove member / leave `{ userId }` (blocked while unsettled)             |
| `POST`   | `/api/groups/:id/invite`  | Create or rotate the invite link code (admin only)                       |
| `DELETE` | `/api/groups/:id/invite`  | Revoke the invite link (admin only)                                      |
| `GET`    | `/api/groups/join/:code`  | Preview the group behind an invite link                                  |
| `POST`   | `/api/groups/join/:code`  | Join the group via invite link                                           |
| `POST`   | `/api/import`             | Import Splitwise CSV `{ groupId, csv, dryRun?, mapping? }`               |

### Expenses

| Method   | Route                        | Description                                                                                                                                                           |
| -------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/expenses`              | List expenses `?groupId= &friendId= &search= &category= &limit=`                                                                                                      |
| `POST`   | `/api/expenses`              | Create expense with splits (`receiptUrl?`, `isRecurring?`, `recurringInterval?`; `splitType: "itemized"` takes `items[{name, amount, assignedTo[]}]`, `tax?`, `tip?`) |
| `GET`    | `/api/expenses/:id`          | Expense detail with splits, comments, attachments                                                                                                                     |
| `PATCH`  | `/api/expenses/:id`          | Update expense (payer only)                                                                                                                                           |
| `DELETE` | `/api/expenses/:id`          | Delete expense (payer only)                                                                                                                                           |
| `POST`   | `/api/expenses/:id/comments` | Add comment `{ text }`                                                                                                                                                |

### Payments & Balances

| Method | Route                    | Description                                                                                                         |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/payments`          | List payments `?groupId=`                                                                                           |
| `POST` | `/api/payments`          | Record payment `{ payerId?, receiverId, amount, currency, groupId?, notes? }` — amount must not exceed what is owed |
| `POST` | `/api/reminders`         | Remind someone to settle up `{ userId }` (1/hour per person)                                                        |
| `GET`  | `/api/balances`          | Overall balances converted to user's preferred currency                                                             |
| `GET`  | `/api/balances?groupId=` | Group balances converted to group's currency + simplified debts                                                     |

### Social

| Method   | Route              | Description                                        |
| -------- | ------------------ | -------------------------------------------------- |
| `GET`    | `/api/friends`     | List friends and requests (`status`, `isIncoming`) |
| `POST`   | `/api/friends`     | Send a friend request by email `{ email }`         |
| `PATCH`  | `/api/friends/:id` | Accept a pending request (recipient only)          |
| `DELETE` | `/api/friends/:id` | Remove friend / decline / cancel request           |

### Misc

| Method   | Route                                | Description                                                            |
| -------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `GET`    | `/api/activity`                      | Activity feed `?groupId= &limit=`                                      |
| `GET`    | `/api/notifications`                 | All notifications                                                      |
| `GET`    | `/api/notifications?unreadOnly=true` | Unread count `{ count }`                                               |
| `PATCH`  | `/api/notifications`                 | Mark read `{ id }` or `?markAllRead=true`                              |
| `GET`    | `/api/analytics?months=`             | Spending stats (monthly, category, top expenses)                       |
| `GET`    | `/api/currency?from=&to=&amount=`    | FX rate conversion                                                     |
| `GET`    | `/api/export?type=csv`               | Download CSV (`&from=YYYY-MM-DD&to=YYYY-MM-DD` optional)               |
| `GET`    | `/api/export?type=json`              | Download expenses as JSON                                              |
| `POST`   | `/api/upload`                        | Upload image (`folder=avatars\|receipts`) → URL                        |
| `GET`    | `/api/cron/recurring`                | Create due recurring expenses (needs `CRON_SECRET` bearer)             |
| `GET`    | `/api/users/me`                      | Current user profile                                                   |
| `PATCH`  | `/api/users/me`                      | Update profile, currency, timezone, payment handles, or password       |
| `POST`   | `/api/users/me/2fa`                  | `{action: setup\|enable\|disable, code?, password?}` — TOTP two-factor |
| `GET`    | `/api/push`                          | Push config `{ enabled, publicKey }`                                   |
| `POST`   | `/api/push`                          | Save a push subscription (`PushSubscription` JSON)                     |
| `DELETE` | `/api/push`                          | Remove a subscription `{ endpoint }`                                   |
| `DELETE` | `/api/users/me`                      | Delete (anonymise) account `{ password }`                              |

---

## Split Types Explained

### Equal

Total divided evenly. Remainder (from rounding) added to the first participant.

```
$100 ÷ 3 = $33.33 + $33.33 + $33.34
```

### Percentage

Each person covers their specified percentage. Must sum to 100%.

```
Alice 50% = $50, Bob 30% = $30, Carol 20% = $20
```

### Shares

Proportional split by share count. Useful for "Alice eats twice as much."

```
Alice 2 shares, Bob 1 share → Alice $66.67, Bob $33.33
```

### Custom

Manually enter exact amounts per person. Must sum to the total (within ±$0.02 tolerance for rounding).

### Itemized

Add line items (e.g. pizza $30, salad $10) and tick who shared each one. Each item is split equally among
its people; **tax and tip are shared in proportion to each person's item subtotal**. The total is
`items + tax + tip` (the server rejects mismatches) and rounding differences go to the largest share so the
splits always add up exactly.

---

## Balance Algorithm

Balances are **never stored** — they are computed on demand from expense splits and payments. This means editing or deleting an expense always reflects correctly.

```
net(A→B) = Σ splits[userId=B, expense.paidBy=A]
         - Σ splits[userId=A, expense.paidBy=B]
         + Σ payments[payer=B, receiver=A]
         - Σ payments[payer=A, receiver=B]
```

**Debt simplification** (`lib/calculations.ts → simplifyDebts`) uses a greedy creditor/debtor matching algorithm that produces the minimum number of transactions needed to settle a group. For `n` people, at most `n-1` payments are needed regardless of how many expenses exist.

### Multi-currency balances

Every expense stores its original `currency`. The `/api/balances` endpoint converts all split amounts to a common target currency before summing:

- **Overall balances** → converted to the user's preferred currency (`session.user.currency`)
- **Group balances** → converted to the group's currency

Exchange rates are fetched from [exchangerate-api.com](https://www.exchangerate-api.com/) with a 1-hour server-side cache, falling back to hardcoded rates if the API key is not set.

---

## Demo Accounts

After running `npm run db:seed`:

| Email               | Password   | Role                  |
| ------------------- | ---------- | --------------------- |
| `alice@example.com` | `demo1234` | Pro user, group admin |
| `bob@example.com`   | `demo1234` | Regular user          |
| `carol@example.com` | `demo1234` | Regular user          |

The seed creates a "Paris Trip 2024" group with three shared expenses (dinner, tickets, hotel) and one personal Netflix split between Alice and Bob.

---

## Troubleshooting

### `prisma db push` hangs or asks for `--accept-data-loss`

Supabase's pooled URL (pgbouncer, port 6543) can hang on schema changes. Push with the direct URL:

```bash
set -a; . ./.env; set +a
DATABASE_URL="$DIRECT_URL" npx prisma db push
```

Prisma warns about the unique `inviteCode` column; it is new and empty, so `--accept-data-loss` is safe there.

### Locked out after enabling two-factor auth

Use one of the 8 recovery codes in the "Authentication code" field. If you have none left, clear it in the
database: `UPDATE users SET "totpEnabled" = false, "totpSecret" = NULL WHERE email = '…';`

### Playwright can't launch a browser

Run `npx playwright install chromium`. If port 3100 is busy, stop the other process (the tests start their own server).

### Password reset email never arrives

Set `RESEND_API_KEY` and `EMAIL_FROM` (a sender verified in Resend). Without them, the reset link is
only returned in local development and nothing is sent in production.

### Recurring expenses are not created

The cron only runs on Vercel production, and `CRON_SECRET` must be set. Locally, trigger it with
`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recurring`.

### Node version mismatch on `npm install`

All packages now require **Node.js ≥ 24**. Switch versions with nvm:

```bash
nvm install 24   # one-time download
nvm use          # reads .nvmrc automatically
npm install
```

### Prisma Studio crashes with `ERR_STREAM_UNABLE_TO_PIPE`

This is a known Prisma Studio incompatibility with Node.js v22+. Run it with Node 20 instead:

```bash
nvm exec 20 npx prisma studio
```

### `prisma db push` fails with "datasource.url is required"

`prisma.config.ts` loads `.env` using `process.loadEnvFile()`. Make sure your `.env` file exists in the project root and contains `DATABASE_URL`. On Vercel/CI the env vars are injected by the platform and no `.env` file is needed.

### `prisma generate` fails

Make sure `DATABASE_URL` is set in `.env` and the database is accessible:

```bash
npx prisma generate
npx prisma db push
```

### Balances show wrong currency symbol but same number

This happens when the React Query cache for `['balances']` hasn't been invalidated after changing the preferred currency in Settings. The fix is already in place — saving Preferences now invalidates the balances cache, triggering a fresh fetch with the new currency conversion.

### `npm audit` reports 2 moderate postcss vulnerabilities

This is a **known false positive**. `npm audit` flags a postcss copy bundled _inside_ Next.js for its internal CSS pipeline. It is not reachable from user input or application code. The "fix" npm suggests would downgrade Next.js — **do not run it**.

### "Session not found" / auth redirect loops

1. Check `NEXTAUTH_SECRET` is set (≥ 32 chars)
2. Check `NEXTAUTH_URL` matches the URL you're using (including port)
3. Clear cookies and try again

### PWA icons show as blank

Run `npm run icons` to generate placeholder icons. Replace them with real PNGs before production:

```bash
npm run icons
# then replace public/icons/*.png with real artwork
```

### Port already in use

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

---

## Upgrade Notes

### Feature release 4: import that actually saves

- **Imports were silently rolling back.** The route inserted one row at a time inside a single transaction; on a
  remote database that cost ~0.8 s/row, so ~270 rows hit the 60 s limit and nothing was saved. It now inserts in
  bulk in one atomic batch (4 statements regardless of size), returns JSON errors, and caps files at 5,000 rows.
- Dates like `2/10/26` are parsed explicitly as US month/day (previously relied on `new Date()` guessing).
- Categories are matched by keyword ("Transportation - Other" → transport, "Gas/fuel" → transport, "Heat/gas" → utilities).
- **Groups show every expense.** The group page loaded only the newest 50 with no way to see more; it now has
  "Show more" (cursor paging with a lighter `?view=list` payload).
- The recurring-expense cron uses one atomic batch per template instead of an interactive transaction, which
  could fail to start on a high-latency database.

### Feature release 3: payments, activity and currency polish

- **Payments are calculated.** The settle-up amount and currency are read-only; `POST /api/payments` rejects
  amounts above what the payer owes (converted to the payment currency) and payments between two other people.
  Either side of a debt can record it (`payerId` is optional). Settle links now carry `currency`/`payerId`.
- **Friends no longer duplicate.** `ensureFriendship()` checks both directions; `GET /api/friends` collapses
  legacy duplicates (accepted beats pending); removing a friend deletes every row for the pair.
- **Currency everywhere.** New `<Money />` component (symbol + "≈" conversion), thousands separators, no cents
  for JPY, ISO code for unknown currencies; activity/notification text no longer hardcodes `$`; analytics converts
  each expense into your currency before summing.
- **Activity page rebuilt.** Structured `metadata` on activities, day grouping, All/Expenses/Payments/Groups
  filters, per-user impact, and notifications stay visible after they're read. Expenses you share with a friend
  (no group) and payments to/from you now appear in the other person's feed too.
- **Don't put `NODE_ENV` in `.env`.** Next.js sets it itself; a `development` value breaks production builds
  (the Playwright config now ignores it).

### Feature release 2: complete feature set

- Removed the unused `isPro` column everywhere (schema, auth token, API, types).
- New models: `ExpenseItem`, `EmailVerificationToken`, `PushSubscription`; new fields on `User` (`emailVerified`,
  `totpSecret`, `totpEnabled`, `recoveryCodes`, `locale`), `Group` (`simplifyDebts`, `defaultSplit`) and `Expense` (`tax`, `tip`).
- **Bugs found by the new browser tests and fixed:** password-reset pages were unreachable when signed out;
  "Record Payment" silently did nothing (hidden required fields); direct-loading the expense form could submit
  without a payer; desktop users had no group menu; the offline queue never ran (mutations pause offline by default);
  SVG avatars were rejected by the image optimiser in production; saving redirected via `router.back()`.

### Feature release: all features free

- Removed the Pro upsell and `/api/users/upgrade`; analytics, recurring, export are available to everyone.
- New schema fields: `Group.inviteCode`, `User.venmo`, `User.paypal`, `User.upi`. Run `prisma db push` (see Troubleshooting).
- Friendships now start as `pending`; existing `accepted` friendships are unaffected.
- New env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `DIRECT_URL` (optional).

This project has been migrated from the original Next.js 14 scaffold through the following major version upgrades:

| Package               | Before | After    | Notes                                                           |
| --------------------- | ------ | -------- | --------------------------------------------------------------- |
| `next`                | 14.2   | **16.x** | Async params; `middleware.ts` → `proxy.ts`; `next lint` removed |
| `react` / `react-dom` | 18.x   | 19.x     | Required by Next.js 15+                                         |
| `eslint`              | 8.x    | **10.x** | Native flat config; no `FlatCompat` needed                      |
| `prisma`              | 5.10   | **7.x**  | Client engine; `prisma.config.ts`; `@prisma/adapter-pg` needed  |
| `tailwindcss`         | 3.4    | **4.x**  | CSS-first config via `@theme` in `globals.css`                  |
| Node.js               | any    | **24**   | Set in `.nvmrc`                                                 |

### Key architectural changes

**Prisma v7 — client engine + adapter**

Prisma v7 defaults to a pure TypeScript client engine (no Rust binary). Connecting to PostgreSQL now requires `@prisma/adapter-pg`:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

The datasource URL also moves from `schema.prisma` to `prisma.config.ts`. Any script that instantiates `PrismaClient` (e.g. seed scripts) must also pass the adapter.

**Tailwind v4 — CSS-first config**

`tailwind.config.ts` is replaced by a `@theme { }` block inside `app/globals.css`. All color tokens, fonts, and animations are defined there. The `@apply` directive can no longer reference custom `@layer components` classes — each variant must inline its own utilities.

**Next.js 16 — middleware renamed**

Next.js 16 renames the middleware entry point from `middleware.ts` to `proxy.ts`. The `next lint` CLI command is also removed — use `eslint .` directly.

**ESLint 10 — native flat config**

`eslint-config-next` v16 exports native flat config arrays. The `FlatCompat` wrapper is no longer needed. `eslint.config.mjs` imports `nextConfig` and `tsConfig` directly and spreads them.

---

## License

MIT — free to use, modify, and deploy.
