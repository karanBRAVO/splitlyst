# Deployment

Splitlyst is built for Vercel with a hosted PostgreSQL database (Supabase, Neon, Railway or similar).

## 1. Create the database

Create a new, empty database for production. Do not reuse the one you tested against. Keep two connection strings: a **pooled** one for the running app (`DATABASE_URL`) and a **direct** one for schema changes.

## 2. Import the project

Push the repository to GitHub, then go to [vercel.com/new](https://vercel.com/new) and import it. Vercel detects Next.js and uses the settings in `vercel.json`. The Vercel CLI works too: `npm i -g vercel && vercel`.

## 3. Set environment variables

In Project, Settings, Environment Variables, add the variables from [Configuration](configuration.md). The minimum for a working production app:

```text
DATABASE_URL        pooled connection string
NEXTAUTH_URL        https://your-app.vercel.app
NEXTAUTH_SECRET     random, 32+ characters
CRON_SECRET         random; Vercel sends it as a Bearer token to the cron route
```

Also set `REDIS_URL` (see [Rate limiting and Redis](configuration.md#rate-limiting-and-redis)). Without it each serverless instance keeps its own rate-limit counters, so the limits are easy to get around. Add `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` for email, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in, and the `VAPID_*` variables for push. Add the production callback URL to your Google OAuth client.

Use different secrets and a different database for each environment (Production, Preview, Development).

## 4. Create the tables

Push the schema to the production database once, using the direct connection:

```bash
DATABASE_URL='<direct connection string>' npm run db:push
```

Set `DATABASE_URL` on the same line. Without it the command uses the value in your local `.env` and changes that database instead.

Why the direct connection: a pooler hands out connections per transaction, which suits the app but breaks the session-level locks and multi-statement changes that `prisma db push` relies on, so it can hang or fail. Supabase's direct host is IPv6-only on the free tier. If you cannot reach it, use the **session pooler** string instead (pooler host, port 5432), which behaves like a direct connection.

## 5. Check it

Register an account, sign in with Google, and request a password reset. If email fails, check the function logs in Vercel, and run `npm run test:connections` locally with the production values. It also checks that Redis is reachable.

## Cron job

`vercel.json` registers a daily job (`0 6 * * *` UTC) for `/api/cron/recurring`, which creates due recurring expenses. Vercel only runs cron jobs on production deployments. To trigger it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/recurring
```

## Installing as an app (PWA)

Splitlyst is a Progressive Web App.

- **Android (Chrome):** menu, then "Add to Home screen".
- **iOS (Safari):** Share, then "Add to Home Screen".
- **Desktop (Chrome or Edge):** click the install icon in the address bar.

The service worker (`public/sw.js`) caches visited pages (network first) and static assets (cache first). API calls return `{ "offline": true }` without a network, and expenses added offline are queued on the device and synced when the connection returns.
