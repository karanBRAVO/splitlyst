# Testing and code quality

## Unit and API tests

```bash
npm test            # Jest
npm run test:watch
```

Route tests mock `@/lib/prisma` and `@/lib/auth`, so they run without a database. They cover split and balance math (including itemised tax and tip), TOTP (RFC 6238 vectors), rate limiting, email sending, translation completeness, Splitwise CSV import, the offline queue, the recurring-expense cron, friend requests, invite links, reminders, sign-in throttling, the rate-limit stores (memory, Redis and the fallback between them) and the
connection checks. Redis is replaced by a small in-memory fake in these tests.

## End-to-end tests

Playwright drives Chromium against a **production build** of the app and the database in your `.env`. It creates throw-away users with `@e2e.test` addresses and runs with email disabled, so nothing is sent.

```bash
npx playwright install chromium   # once
npm run test:e2e                  # builds, serves on :3100, runs the suite
npx playwright show-report        # HTML report; screenshots and traces on failure
```

> The e2e suite writes to the database in `DATABASE_URL`. Point it at a test database, never at production.

The rate-limit specs use in-memory limits by default. To run them against a real Redis, pass its URL:

```bash
E2E_REDIS_URL=redis://localhost:6379 npx playwright test e2e/rate-limit.spec.ts
```

Run a single file while developing, for example `npx playwright test e2e/mobile-nav.spec.ts`.

## Redis integration tests

`__tests__/lib/rate-limit/redis.integration.test.ts` runs the Redis store against a real server: the window and expiry,
exact counting under 60 concurrent requests, counters shared between separate connections, and what happens when nothing
is listening. It is skipped unless `REDIS_TEST_URL` is set. Use a throwaway Redis, because it writes keys under
`splitlyst:rl:it:`:

```bash
docker run --rm -p 6390:6379 redis:7          # or: redis-server --port 6390 --save ''
REDIS_TEST_URL=redis://localhost:6390 npx jest __tests__/lib/rate-limit/redis.integration
```

## Connection checks

Verify that everything the app depends on is reachable, before starting it and after deploying:

```bash
npm run test:connections
```

Example output:

```text
Splitlyst — connection tests

1 · Database (PostgreSQL via Prisma)
  ·  URL: postgresql://user:****@host:6543/postgres
  ✓  Connected  (Xms)
  ✓  Tables reachable — users: 0, groups: 0, expenses: 0

2 · Exchange Rate API (exchangerate-api.com)
  ·  Key: 068f********...
  ✓  Connected  (Xms)
  ✓  Sample rates: EUR=0.87  GBP=0.75  JPY=161  INR=94  CAD=1.42

3 · Email (Gmail/SMTP or Resend)
  ·  Provider: SMTP (smtp.gmail.com:465, from Splitlyst <you@gmail.com>)
  ✓  Connected and logged in (nothing was sent)
  ? Send a real test email too? Enter an address (or press Enter to skip): you@example.com
  ✓  Sent to you@example.com — check the inbox (and spam)

4 · Rate limiting (Redis)
  ·  URL: rediss://default:****@your-host.upstash.io:6379
  ✓  Connected and writable  (Xms)

Summary
  ✓  Database
  ✓  Exchange Rate API
  ✓  Email
  ✓  Rate limiting
```

- **Database:** a wrong `DATABASE_URL` fails with the exact error; the password is always masked.
- **Exchange rates:** without `EXCHANGE_RATE_API_KEY` the check is _skipped_ (the app falls back to hardcoded rates).
- **Email:** for SMTP it connects and logs in **without sending anything**, then **asks** whether to send a real test
  message — type an address, or press Enter to skip. Resend has no free login check, so it only proves itself when you
  send. With no provider configured the check is skipped (links are only shown in local development).
- **Rate limiting:** without `REDIS_URL` the check is _skipped_ (limits then live in each server's memory). With it set, the
  check connects, sends `PING` and writes a short-lived key, so a read-only user or a wrong password fails here and not in
  production. The password in the URL is masked.
- **No terminal (CI):** the prompt is skipped automatically, so the run never hangs.
- Exit code is `1` if any check _failed_ (skipped is fine) and `2` for bad arguments.
- Each check lives in its own file under `scripts/connections/` (`database.ts`, `exchange-rate.ts`, `email.ts`, `rate-limit.ts`),
  orchestrated by `scripts/test-connections.ts`.

## Lint, format, types and build

```bash
npm run lint
npm run format:check   # npm run format to fix
npx tsc --noEmit
npm run build
```

- **Prettier** (`prettier.config.mjs`): 100 columns, single quotes, semicolons, trailing commas, and `prettier-plugin-tailwindcss` to sort Tailwind classes.
- **ESLint** (`eslint.config.mjs`): flat config built on `eslint-config-next` (core web vitals and TypeScript), with `eslint-config-prettier` to avoid conflicts.
- **Husky and lint-staged:** a pre-commit hook runs Prettier and ESLint on the files you staged. It is installed automatically by `npm install`.

## Continuous integration

`.github/workflows/ci.yml` runs format check, lint, type check, unit tests and a production build on every pull request and on pushes to `master`, `qa` and `dev`. It uses placeholder environment values and needs no secrets.
