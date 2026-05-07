# Splitlyst

> Split bills, track shared expenses, and settle up with friends and groups — all in one place.

A full-featured, open-source Splitwise alternative built with Next.js 15, PostgreSQL, and Prisma. Installable as a Progressive Web App (PWA) and deployable to Vercel in minutes.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Local)](#quick-start-local)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Running the App](#running-the-app)
8. [Code Quality](#code-quality)
9. [Deploy to Vercel](#deploy-to-vercel)
10. [PWA Installation](#pwa-installation)
11. [Project Structure](#project-structure)
12. [API Reference](#api-reference)
13. [Split Types Explained](#split-types-explained)
14. [Balance Algorithm](#balance-algorithm)
15. [Demo Accounts](#demo-accounts)
16. [Troubleshooting](#troubleshooting)
17. [Upgrade Notes](#upgrade-notes)

---

## Features

### Core

| Feature             | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| **Auth**            | Email + password signup/login with JWT sessions (30-day expiry) |
| **Groups**          | Create groups, invite members by email, set admin roles         |
| **Friends**         | Add friends by email, view personal balances                    |
| **Expenses**        | Add, edit, delete expenses with descriptions, dates, categories |
| **Split Types**     | Equal · Percentage · Shares · Custom amounts                    |
| **Balances**        | Real-time balance calculation across groups and friends         |
| **Settle Up**       | Minimum-transaction debt simplification algorithm               |
| **Payments**        | Record payments, auto-update balances                           |
| **Activity Feed**   | Full history of all expense and payment events                  |
| **Notifications**   | In-app notifications for new expenses and payments              |
| **Comments**        | Per-expense comment threads                                     |
| **Multi-currency**  | 20+ currencies with fallback exchange rates                     |
| **Export**          | Download expenses as CSV or JSON                                |
| **Search & Filter** | Filter expenses by keyword and category                         |
| **PWA**             | Install on iOS/Android, works offline                           |

### Pro Features (flag `isPro = true` in the database)

| Feature                 | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| **Analytics Dashboard** | Monthly spending, category breakdown, trend charts (Recharts) |
| **Recurring Expenses**  | Templates that auto-generate on a schedule                    |
| **Smart Settle-Up**     | Graph-based debt minimisation (O(n) transactions)             |
| **Payment Links**       | Pre-fill settle-up flows with deep links                      |
| **Export Reports**      | Extended CSV/JSON statements                                  |

---

## Tech Stack

| Layer         | Technology                                 | Version    |
| ------------- | ------------------------------------------ | ---------- |
| Framework     | [Next.js](https://nextjs.org) (App Router) | 15.x       |
| Language      | TypeScript                                 | 5.8+       |
| UI            | React                                      | 19.x       |
| Styling       | Tailwind CSS                               | 3.4.x      |
| Database ORM  | Prisma                                     | 6.x        |
| Database      | PostgreSQL                                 | 14+        |
| Auth          | NextAuth.js (JWT)                          | 4.x        |
| Data Fetching | TanStack Query                             | 5.x        |
| Forms         | React Hook Form + Zod                      | 7.x / 3.x  |
| Charts        | Recharts                                   | 2.x        |
| Icons         | Lucide React                               | 0.5xx      |
| Node.js       | LTS                                        | **22.x**   |
| Formatter     | Prettier + prettier-plugin-tailwindcss     | 3.x        |
| Linter        | ESLint (flat config)                       | 9.x        |
| Git hooks     | Husky + lint-staged                        | 9.x / 15.x |

> **Tailwind v4:** The project targets Tailwind CSS v3. Tailwind v4 introduces a CSS-first config system and is a breaking change. A migration guide will be added separately when needed.

---

## Prerequisites

### Node.js 22 (required)

The project requires **Node.js 22 LTS**. Use [nvm](https://github.com/nvm-sh/nvm) to manage versions:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node 22 (reads .nvmrc automatically)
nvm install 22
nvm use
```

Verify:

```bash
node --version   # v22.x.x
npm --version    # 10.x.x
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
nvm use   # reads .nvmrc → Node 22

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# → edit .env with your DATABASE_URL and NEXTAUTH_SECRET (see below)

# 4. Push schema to database
npm run db:push

# 5. (Optional) Seed with demo data
npm run db:seed

# 6. Generate PWA icons
npm run icons

# 7. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                | Required | Description                                                                               |
| ----------------------- | :------: | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`          |    ✅    | PostgreSQL connection string                                                              |
| `NEXTAUTH_SECRET`       |    ✅    | Random string ≥ 32 characters for JWT signing                                             |
| `NEXTAUTH_URL`          |    ✅    | Full base URL of the app (e.g. `http://localhost:3000`)                                   |
| `EXCHANGE_RATE_API_KEY` |    ❌    | Free key from [exchangerate-api.com](https://www.exchangerate-api.com/) for live FX rates |
| `NEXT_PUBLIC_APP_URL`   |    ❌    | Same as `NEXTAUTH_URL` — used in OpenGraph metadata                                       |

### Generate a strong secret

```bash
openssl rand -base64 32
```

### Example `.env`

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/splitlyst"
NEXTAUTH_SECRET="abc123...your-32+-char-random-string"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Database Setup

### 1. Push schema (development / first deploy)

```bash
npm run db:push
```

Prisma introspects `prisma/schema.prisma` and creates all tables without writing a migration file. Use this for local dev and initial deploys.

### 2. Run migrations (production workflow)

```bash
npm run db:migrate
# prompts for a migration name
```

This creates a versioned SQL file in `prisma/migrations/` and applies it. Commit this file to source control.

### 3. Open Prisma Studio (GUI browser for your data)

```bash
npm run db:studio
# → opens http://localhost:5555
```

### 4. Seed demo data

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

## Code Quality

The project uses **Prettier**, **ESLint**, and **Husky** to keep code consistently formatted and error-free from the first commit.

### Prettier

[Prettier](https://prettier.io) enforces a single code style across TypeScript, JSON, CSS, and Markdown. Key settings (`prettier.config.ts`):

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

ESLint uses the **flat config** format (`eslint.config.mjs`) introduced in ESLint 9. The config extends:

- `next/core-web-vitals` — Next.js recommended rules
- `next/typescript` — TypeScript-specific rules
- `prettier` — disables all ESLint rules that conflict with Prettier (via `eslint-config-prettier`)

```bash
npm run lint        # report issues
npm run lint:fix    # auto-fix where possible
```

### Husky + lint-staged

[Husky](https://typicode.github.io/husky/) registers a **pre-commit** git hook. Every time you `git commit`, [lint-staged](https://github.com/lint-staged/lint-staged) runs Prettier and ESLint **only on the files you staged** — fast feedback, zero noise.

The pre-commit hook (`.husky/pre-commit`):

```bash
npx lint-staged
```

The lint-staged config (inside `package.json`):

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs,cjs}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css,yaml,yml,toml}": ["prettier --write"]
  }
}
```

> **First-time setup:** Husky hooks are installed automatically when you run `npm install` because the `prepare` script runs `husky`. No manual step needed.

### CI format check

Add this step to your GitHub Actions workflow to block PRs with unformatted code:

```yaml
- name: Check formatting
  run: npm run format:check
- name: Lint
  run: npm run lint
```

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

Or use Prisma's `--url` flag:

```bash
npx prisma db push --schema=prisma/schema.prisma
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
│   │   ├── login/page.tsx
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
│   │   │   ├── new/page.tsx      # Add expense (all split types)
│   │   │   └── [id]/page.tsx     # Expense detail + comments
│   │   ├── activity/page.tsx     # Activity feed + notifications
│   │   ├── analytics/page.tsx    # Charts (Pro)
│   │   └── settings/page.tsx     # Profile, security, preferences
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/    # NextAuth handler
│   │   │   └── register/        # POST /api/auth/register
│   │   ├── groups/              # CRUD + members
│   │   ├── expenses/            # CRUD + comments
│   │   ├── payments/            # Record payments
│   │   ├── friends/             # Add/remove friends
│   │   ├── balances/            # Computed balances (no stored state)
│   │   ├── activity/            # Activity log
│   │   ├── notifications/       # Read/mark-read
│   │   ├── analytics/           # Spending stats (server-computed)
│   │   ├── currency/            # FX rate lookup
│   │   ├── export/              # CSV / JSON download
│   │   └── users/me/            # Profile CRUD + password change
│   ├── globals.css              # Tailwind base + custom component classes
│   ├── layout.tsx               # Root layout + PWA meta + SW registration
│   └── page.tsx                 # Public landing page
│
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx          # Desktop sidebar navigation
│   │   ├── mobile-nav.tsx       # Mobile bottom tab bar
│   │   └── header.tsx           # Mobile top header
│   ├── ui/
│   │   ├── avatar.tsx           # Avatar + AvatarGroup
│   │   ├── dropdown.tsx         # Accessible dropdown menu
│   │   ├── empty-state.tsx      # Empty state placeholder
│   │   ├── loading.tsx          # Spinner + skeleton loaders
│   │   ├── modal.tsx            # Modal + ConfirmModal
│   │   └── toaster.tsx          # Zero-dependency toast system
│   └── providers.tsx            # SessionProvider + QueryClientProvider
│
├── lib/
│   ├── auth.ts                  # NextAuth options (JWT, credentials)
│   ├── calculations.ts          # Split logic + debt simplification
│   ├── currency.ts              # Exchange rate fetch + convert
│   ├── prisma.ts                # Singleton Prisma client
│   └── utils.ts                 # cn(), formatCurrency, formatDate, …
│
├── prisma/
│   ├── schema.prisma            # Database schema (12 models)
│   └── seed.ts                  # Demo data seeder
│
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker (cache strategies)
│   └── icons/                   # PWA icons (generated by scripts/generate-icons.js)
│
├── scripts/
│   └── generate-icons.js        # SVG → PNG icon generator
│
├── types/
│   └── index.ts                 # Shared TypeScript types + constants
│
├── .env.example                 # Template for environment variables
├── .nvmrc                       # Node.js version pin (22)
├── .prettierignore              # Files excluded from Prettier formatting
├── .husky/pre-commit            # Git pre-commit hook (runs lint-staged)
├── eslint.config.mjs            # ESLint 9 flat config (includes prettier)
├── prettier.config.mjs          # Prettier config + tailwindcss plugin
├── next.config.ts               # Next.js 15 TypeScript config
├── tailwind.config.ts           # Tailwind CSS v3 config
├── tsconfig.json                # TypeScript strict mode
└── vercel.json                  # Vercel deployment config
```

---

## API Reference

All API routes are under `/api`. All protected routes require a valid session cookie (set automatically by NextAuth).

### Auth

| Method | Route                     | Description                                |
| ------ | ------------------------- | ------------------------------------------ |
| `POST` | `/api/auth/register`      | Create account `{ name, email, password }` |
| `POST` | `/api/auth/[...nextauth]` | NextAuth sign-in / sign-out / session      |

### Groups

| Method   | Route                     | Description                                                              |
| -------- | ------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/groups`             | List groups for current user                                             |
| `POST`   | `/api/groups`             | Create group `{ name, description?, currency, category, memberEmails? }` |
| `GET`    | `/api/groups/:id`         | Group detail with members, expenses, counts                              |
| `PATCH`  | `/api/groups/:id`         | Update group (admin only)                                                |
| `DELETE` | `/api/groups/:id`         | Delete group (admin only)                                                |
| `POST`   | `/api/groups/:id/members` | Add member by email (admin only)                                         |
| `DELETE` | `/api/groups/:id/members` | Remove member `{ userId }`                                               |

### Expenses

| Method   | Route                        | Description                                                      |
| -------- | ---------------------------- | ---------------------------------------------------------------- |
| `GET`    | `/api/expenses`              | List expenses `?groupId= &friendId= &search= &category= &limit=` |
| `POST`   | `/api/expenses`              | Create expense with splits                                       |
| `GET`    | `/api/expenses/:id`          | Expense detail with splits, comments, attachments                |
| `PATCH`  | `/api/expenses/:id`          | Update expense (payer only)                                      |
| `DELETE` | `/api/expenses/:id`          | Delete expense (payer only)                                      |
| `POST`   | `/api/expenses/:id/comments` | Add comment `{ text }`                                           |

### Payments & Balances

| Method | Route                    | Description                                                         |
| ------ | ------------------------ | ------------------------------------------------------------------- |
| `GET`  | `/api/payments`          | List payments `?groupId=`                                           |
| `POST` | `/api/payments`          | Record payment `{ receiverId, amount, currency, groupId?, notes? }` |
| `GET`  | `/api/balances`          | Overall balances for current user                                   |
| `GET`  | `/api/balances?groupId=` | Group-specific balances + simplified debts                          |

### Social

| Method   | Route              | Description                         |
| -------- | ------------------ | ----------------------------------- |
| `GET`    | `/api/friends`     | List friends with friendship status |
| `POST`   | `/api/friends`     | Add friend by email                 |
| `DELETE` | `/api/friends/:id` | Remove friendship                   |

### Misc

| Method  | Route                                | Description                                      |
| ------- | ------------------------------------ | ------------------------------------------------ |
| `GET`   | `/api/activity`                      | Activity feed `?groupId= &limit=`                |
| `GET`   | `/api/notifications`                 | All notifications                                |
| `GET`   | `/api/notifications?unreadOnly=true` | Unread count `{ count }`                         |
| `PATCH` | `/api/notifications`                 | Mark read `{ id }` or `?markAllRead=true`        |
| `GET`   | `/api/analytics?months=`             | Spending stats (monthly, category, top expenses) |
| `GET`   | `/api/currency?from=&to=&amount=`    | FX rate conversion                               |
| `GET`   | `/api/export?type=csv`               | Download expenses as CSV                         |
| `GET`   | `/api/export?type=json`              | Download expenses as JSON                        |
| `GET`   | `/api/users/me`                      | Current user profile                             |
| `PATCH` | `/api/users/me`                      | Update profile or change password                |

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

### Node version mismatch on `npm install`

All packages now require **Node.js ≥ 22**. Switch versions with nvm:

```bash
nvm install 22   # one-time download
nvm use          # reads .nvmrc automatically
npm install
```

### `npm audit` reports 2 moderate postcss vulnerabilities

This is a **known false positive**. `npm audit` flags a postcss copy that is bundled _inside_ Next.js for its internal CSS build pipeline. It is not reachable from user input or application code.

The "fix" npm suggests (`npm audit fix --force`) would downgrade Next.js to v9 — **do not run it**. The Next.js team tracks this internally; it will be resolved in a future Next.js release.

### `npm install` shows deprecation warnings

Remaining deprecation warnings (e.g. `inflight`, `rimraf@3`) come from deep transitive dependencies of `next-auth`. They do not affect runtime and will disappear when next-auth releases an updated dependency tree.

### `prisma generate` fails

Make sure `DATABASE_URL` is set in `.env` and the database is accessible, then run:

```bash
npx prisma generate
npx prisma db push
```

### "Session not found" / auth redirect loops

1. Check `NEXTAUTH_SECRET` is set (≥ 32 chars)
2. Check `NEXTAUTH_URL` matches the URL you're using (including port)
3. Clear cookies and try again

### PWA icons show as blank

Run `npm run icons` to generate the placeholder icons. Replace them with real PNGs before production:

```bash
npm run icons
# then replace public/icons/*.png with real artwork
```

### Next.js 15 params type errors

All `[id]` route handlers use `props: { params: Promise<{ id: string }> }` and `await props.params`. If you add new dynamic routes, follow the same pattern.

### Port already in use

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

---

## Upgrade Notes

### From the original Next.js 14 scaffold

This version includes these breaking-change upgrades:

| Package               | Before | After      | Notes                                              |
| --------------------- | ------ | ---------- | -------------------------------------------------- |
| `next`                | 14.2   | 15.x       | Async params in route handlers; security CVE fixed |
| `react` / `react-dom` | 18.x   | 19.x       | Required by Next.js 15                             |
| `eslint`              | 8.x    | 9.x        | New flat config (`eslint.config.mjs`)              |
| `prisma`              | 5.10   | 6.x        | Node ≥ 18 required; query API unchanged            |
| `date-fns`            | 3.x    | 4.x        | ESM-first; same function API                       |
| Node.js               | any    | **22 LTS** | Set in `.nvmrc`                                    |

**Removed packages** (were unused or had better alternatives):

- `multer` → use `request.formData()` for file uploads
- `uuid` → use `crypto.randomUUID()` (built into Node 22)
- `@next-auth/prisma-adapter` → not needed with JWT-only sessions
- `@tanstack/react-query-devtools` → install separately in dev only

### Prettier + Husky (added in this release)

New devDependencies: `prettier`, `prettier-plugin-tailwindcss`, `eslint-config-prettier`, `husky`, `lint-staged`.

After `npm install`, Husky is set up automatically via the `prepare` script. The pre-commit hook runs `lint-staged` which formats and lints only staged files.

If you pulled this update and hooks are not running, re-initialize:

```bash
npx husky init
# then replace .husky/pre-commit content with: npx lint-staged
```

### Tailwind CSS v4 (future)

Tailwind v4 replaces `tailwind.config.ts` with CSS-native `@theme` blocks. Migration is non-trivial and not included here. When ready, follow the [official v4 upgrade guide](https://tailwindcss.com/docs/upgrade-guide).

---

## License

MIT — free to use, modify, and deploy.
