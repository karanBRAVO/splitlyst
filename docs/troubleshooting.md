# Troubleshooting

## `prisma db push` hangs or asks for `--accept-data-loss`

Supabase's pooled URL (pgbouncer, port 6543) can hang on schema changes. Push with the direct URL:

```bash
set -a; . ./.env; set +a
DATABASE_URL="$DIRECT_URL" npm run db:push
```

Prisma warns about the unique `inviteCode` column; it is new and empty, so `--accept-data-loss` is safe there.

## Locked out after enabling two-factor auth

Use one of the 8 recovery codes in the "Authentication code" field. If you have none left, clear it in the
database: `UPDATE users SET "totpEnabled" = false, "totpSecret" = NULL WHERE email = '…';`

## Playwright can't launch a browser

Run `npx playwright install chromium`. If port 3100 is busy, stop the other process (the tests start their own server).

## Password reset email never arrives

Check which provider is active and send yourself a test: `npm run test:connections` (the email step asks for an address). It prints the provider and the failure reason, never the password.

- **Gmail SMTP (free):** turn on 2-Step Verification, create an _App password_, and set `SMTP_USER` and `SMTP_PASS`.
  `535 Username and Password not accepted` means a wrong/expired app password (spaces are fine) or 2-Step Verification is off.
  Gmail sends at most ~500 emails a day and always sends _from_ the account's own address.
- **Resend:** only sends to other people from a domain you verified in Resend; the `onboarding@resend.dev` test
  sender only reaches your own address.
- With nothing configured, the reset link is only returned in local development and nothing is sent in production.

## "Too many failed sign-in attempts"

Ten wrong passwords or two-factor codes for one account, or thirty failures from one IP address, lock sign-in for 15 minutes. The message says how long to wait, and a correct sign-in before the limit resets the account's count.

To unlock an account sooner:

```bash
# Redis: delete the counter for one account (the key uses a hash of the lowercase email)
HASH=$(printf '%s' 'user@example.com' | shasum -a 256 | cut -c1-32)
redis-cli -u "$REDIS_URL" del "splitlyst:rl:login:email:$HASH"

# Redis: clear every sign-in counter
redis-cli -u "$REDIS_URL" --scan --pattern 'splitlyst:rl:login:*' | xargs redis-cli -u "$REDIS_URL" del
```

Without `REDIS_URL` the counters live in the server's memory, so restarting the server clears them.

## Rate limits are not shared between servers, or `[rate-limit] Redis unavailable` in the logs

- `REDIS_URL is not set` in a production log means each instance counts on its own. Set `REDIS_URL`.
- `Redis unavailable, using in-memory limits` means Redis could not be reached or took longer than two seconds. Nothing is blocked, but the limits are per instance until Redis is back. Check the URL, the password and TLS (`rediss://`), and whether the host accepts connections from where the app runs. `npm run test:connections` prints the underlying error.
- `NOPERM` means the Redis user cannot write. The limiter needs `INCR`, `PEXPIRE`, `PTTL`, `GET`, `DEL` and `EVAL`.

## Recurring expenses are not created

The cron only runs on Vercel production, and `CRON_SECRET` must be set. Locally, trigger it with
`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recurring`.

## Node version mismatch on `npm install`

All packages now require **Node.js ≥ 24**. Switch versions with nvm:

```bash
nvm install 24   # one-time download
nvm use          # reads .nvmrc automatically
npm install
```

## Prisma Studio crashes with `ERR_STREAM_UNABLE_TO_PIPE`

This is a known Prisma Studio incompatibility with Node.js v22+. Run it with Node 20 instead:

```bash
nvm exec 20 npx prisma studio
```

## `prisma db push` fails with "datasource.url is required"

`prisma.config.ts` loads `.env` using `process.loadEnvFile()`. Make sure your `.env` file exists in the project root and contains `DATABASE_URL`. On Vercel/CI the env vars are injected by the platform and no `.env` file is needed.

## `prisma generate` fails

Make sure `DATABASE_URL` is set in `.env` and the database is accessible:

```bash
npx prisma generate
npm run db:push
```

## `npm audit` reports 2 moderate postcss vulnerabilities

This is a **known false positive**. `npm audit` flags a postcss copy bundled _inside_ Next.js for its internal CSS pipeline. It is not reachable from user input or application code. The "fix" npm suggests would downgrade Next.js — **do not run it**.

## "Session not found" / auth redirect loops

1. Check `NEXTAUTH_SECRET` is set (≥ 32 chars)
2. Check `NEXTAUTH_URL` matches the URL you're using (including port)
3. Clear cookies and try again

## PWA icons show as blank

Run `npm run icons` to generate placeholder icons. Replace them with real PNGs before production:

```bash
npm run icons
# then replace public/icons/*.png with real artwork
```

## Port already in use

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```
