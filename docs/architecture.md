# Architecture

## Tech stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Framework     | [Next.js](https://nextjs.org) 16 (App Router)  |
| Language      | TypeScript 6                                   |
| UI            | React 19, Tailwind CSS 4                       |
| Database      | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth          | NextAuth.js 4 (JWT sessions), TOTP two-factor  |
| Data fetching | TanStack Query 5                               |
| Forms         | React Hook Form + Zod 4                        |
| Charts        | Recharts 3                                     |
| Email         | Nodemailer (SMTP) or Resend                    |
| Tests         | Jest (unit/API), Playwright (browser)          |
| Tooling       | ESLint 10, Prettier 3, Husky, lint-staged      |
| Runtime       | Node.js 24                                     |

## Project structure

```text
splitlyst/
├── .github/workflows/ci.yml     # CI: format, lint, types, tests, build
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
│   │   │   ├── verify-email/    # GET confirm link · POST resend
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
│   │   ├── header.tsx           # Mobile top header
│   │   └── verify-banner.tsx    # "Verify your email" banner
│   ├── ui/
│   │   ├── avatar.tsx           # Avatar + AvatarGroup (next/image with custom loader)
│   │   ├── dropdown.tsx         # Accessible dropdown menu
│   │   ├── empty-state.tsx      # Empty state placeholder
│   │   ├── google-icon.tsx      # Google logo (inline SVG)
│   │   ├── loading.tsx          # Spinner + skeleton loaders
│   │   ├── modal.tsx            # Modal + ConfirmModal
│   │   ├── money.tsx            # Amount with its currency symbol and converted value
│   │   └── toaster.tsx          # Zero-dependency toast system
│   ├── auth/                    # GoogleButton ("Continue with Google")
│   ├── settings/                # TwoFactorCard, PushToggle
│   └── providers.tsx            # SessionProvider + QueryClientProvider + offline sync
│
├── lib/
│   ├── activity.ts              # Structured activity records
│   ├── auth.ts                  # NextAuth options (JWT, credentials, currency in token)
│   ├── calculations.ts          # Split logic + debt simplification
│   ├── currency.ts              # Exchange rate fetch + convertAmount()
│   ├── email.ts                 # Email: Gmail/any SMTP or Resend (no-op when unconfigured)
│   ├── i18n.ts / use-t.ts       # Translations + `useT()` hook (en, es, fr, de, hi)
│   ├── notify.ts / push.ts      # In-app notification + web-push fan-out
│   ├── offline-queue.ts         # Offline expense queue (localStorage, synced on reconnect)
│   ├── use-rates.ts             # Client-side exchange-rate hook
│   ├── totp.ts                  # RFC 6238 TOTP + recovery codes
│   ├── verification.ts          # Email-verification tokens
│   ├── friends.ts               # ensureFriendship() and duplicate collapsing
│   ├── group-balance.ts         # Net balance of a user in a group (leave-group check)
│   ├── rate-limit/              # Rate limiting with pluggable stores
│   │   ├── index.ts             # Public API: rateLimit(), rateLimitStatus(), ...
│   │   ├── memory-store.ts      # In-process counters (development, and Redis fallback)
│   │   ├── redis-store.ts       # Redis counters (any Redis, via REDIS_URL)
│   │   └── fallback-store.ts    # Use Redis, fall back to memory if it fails
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
│   ├── test-connections.ts      # Runs the connection checks (db, exchange rate, email)
│   └── connections/             # One module per check + shared helpers
│
├── e2e/                         # Playwright browser tests (auth, money, security, features)
├── playwright.config.ts         # Builds + serves the app on :3100 for E2E
│
├── __tests__/
│   ├── lib/                     # Unit tests (calculations, utils, email, rate-limit, import, …)
│   ├── api/                     # Route tests with mocked Prisma/auth
│   └── scripts/                 # Tests for the connection checks
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

## Data model

```text
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

The schema has 16 models; see `prisma/schema.prisma`.

## Split types

### Equal

Total divided evenly. Remainder (from rounding) added to the first participant.

```text
$100 ÷ 3 = $33.33 + $33.33 + $33.34
```

### Percentage

Each person covers their specified percentage. Must sum to 100%.

```text
Alice 50% = $50, Bob 30% = $30, Carol 20% = $20
```

### Shares

Proportional split by share count. Useful for "Alice eats twice as much."

```text
Alice 2 shares, Bob 1 share → Alice $66.67, Bob $33.33
```

### Custom

Manually enter exact amounts per person. Must sum to the total (within ±$0.02 tolerance for rounding).

### Itemized

Add line items (e.g. pizza $30, salad $10) and tick who shared each one. Each item is split equally among
its people; **tax and tip are shared in proportion to each person's item subtotal**. The total is
`items + tax + tip` (the server rejects mismatches) and rounding differences go to the largest share so the
splits always add up exactly.

## How balances are calculated

Balances are **never stored** — they are computed on demand from expense splits and payments. This means editing or deleting an expense always reflects correctly.

```text
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
