# Configuration

All settings are environment variables. Copy `.env.example` to `.env` and edit it.

```bash
cp .env.example .env
```

## Variables

| Variable                                             | Required | Description                                                                                                                                                                                         |
| ---------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       |    ✅    | PostgreSQL connection string                                                                                                                                                                        |
| `NEXTAUTH_SECRET`                                    |    ✅    | Random string ≥ 32 characters for JWT signing                                                                                                                                                       |
| `NEXTAUTH_URL`                                       |    ✅    | Full base URL of the app (e.g. `http://localhost:3000`)                                                                                                                                             |
| `EXCHANGE_RATE_API_KEY`                              |    ❌    | Free key from [exchangerate-api.com](https://www.exchangerate-api.com/) for live FX rates                                                                                                           |
| `NEXT_PUBLIC_APP_URL`                                |    ❌    | Same as `NEXTAUTH_URL` — used in OpenGraph metadata                                                                                                                                                 |
| `CLOUDINARY_CLOUD_NAME`                              |    ❌    | Cloudinary cloud name for avatar uploads                                                                                                                                                            |
| `CLOUDINARY_API_KEY`                                 |    ❌    | Cloudinary API key                                                                                                                                                                                  |
| `CLOUDINARY_API_SECRET`                              |    ❌    | Cloudinary API secret                                                                                                                                                                               |
| `DIRECT_URL`                                         |    ❌    | Non-pooled DB URL — use it for `prisma db push` when `DATABASE_URL` is a pgbouncer pooler                                                                                                           |
| `SMTP_USER` / `SMTP_PASS`                            |    ❌    | **Free email, no domain needed:** a Gmail address + [app password](https://support.google.com/accounts/answer/185833). Optional `SMTP_HOST` (default `smtp.gmail.com`), `SMTP_PORT` (default `465`) |
| `RESEND_API_KEY`                                     |    ❌    | Alternative: [Resend](https://resend.com) key — only sends to others from a domain you have verified there                                                                                          |
| `EMAIL_FROM`                                         |    ❌    | Sender. SMTP defaults to `Splitlyst <SMTP_USER>` (Gmail requires the account's own address); Resend needs a verified domain                                                                         |
| `EMAIL_PROVIDER`                                     |    ❌    | Force `smtp` or `resend` when both are set (default: SMTP if configured, else Resend)                                                                                                               |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |    ❌    | Web push keys — generate with `npx web-push generate-vapid-keys`                                                                                                                                    |
| `VAPID_SUBJECT`                                      |    ❌    | `mailto:` contact for push services, e.g. `mailto:you@yourdomain.com`                                                                                                                               |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`          |    ❌    | Enables Google sign-in. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`                                                                                                                     |
| `REDIS_URL`                                          |    ❌    | Redis for shared rate-limit counters (local, Docker, Upstash, Redis Cloud, AWS...). Recommended in production. See [Rate limiting and Redis](#rate-limiting-and-redis)                              |
| `CRON_SECRET`                                        |   ✅\*   | Secret for `/api/cron/recurring`. \*Required for recurring expenses to run                                                                                                                          |

> Do not put `NODE_ENV` in `.env`. Next.js sets it itself, and a `development` value breaks production builds.

## Generating secrets

`NEXTAUTH_SECRET` and `CRON_SECRET` can be any long random string. Use a different one for each:

```bash
openssl rand -base64 32
```

The VAPID keys for web push come as a pair:

```bash
npx web-push generate-vapid-keys
```

Put the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` is a contact for the push services, either `mailto:you@example.com` or your site URL. Generate new keys for production and keep them stable afterwards: browsers tie push subscriptions to the public key.

## Example `.env`

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/splitlyst"
NEXTAUTH_SECRET="abc123...your-32+-char-random-string"
NEXTAUTH_URL="http://localhost:3000"
CRON_SECRET="any-long-random-string"
# Optional: SMTP_USER / SMTP_PASS (or RESEND_API_KEY / EMAIL_FROM) for email, DIRECT_URL for migrations behind a pooler
```

## Email

Email is used for verification links, password resets, reminders and expense notifications. Without a provider the app still works, and in local development the links are shown on screen instead of sent.

### Gmail (SMTP)

Free, and it does not need a domain.

1. Turn on 2-Step Verification for the Google account.
2. Create an app password at <https://myaccount.google.com/apppasswords>.
3. Set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the app password (spaces are ignored).

Gmail always sends from the account's own address and allows roughly 500 messages a day.

### Resend

Set `RESEND_API_KEY` and `EMAIL_FROM`. Resend only delivers to other people from a domain you have verified in its dashboard. Its `onboarding@resend.dev` test sender only reaches your own address.

If both providers are configured, SMTP is used unless `EMAIL_PROVIDER=resend`.

Run `npm run test:connections` to check the setup.

## Google sign-in

Sign-in with Google is enabled when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen.
2. Create credentials, then **OAuth client ID**, then **Web application**.
3. Add an authorized redirect URI for each environment: `<NEXTAUTH_URL>/api/auth/callback/google`, for example `http://localhost:3000/api/auth/callback/google` and `https://your-app.vercel.app/api/auth/callback/google`.
4. Copy the client ID and secret into `.env`.

While the consent screen is in "Testing" mode only the test users you list can sign in.

## Rate limiting and Redis

Splitlyst limits sign-up, sign-in, password reset, email verification, two-factor attempts and reminders to slow down abuse. Failed sign-ins are counted per account (10 per 15 minutes) and per IP address (30 per 15 minutes); a successful sign-in resets the account's count.

Counters are kept in memory unless you set `REDIS_URL`. That is fine on your own machine, but on Vercel every serverless instance would keep its own count, so the limits are easy to get around. **Set `REDIS_URL` in production.**

Any Redis works, because Splitlyst uses the standard protocol:

| Where           | `REDIS_URL`                                                         |
| --------------- | ------------------------------------------------------------------- |
| Local install   | `redis://localhost:6379`                                            |
| Docker          | `docker run -p 6379:6379 redis:7`, then `redis://localhost:6379`    |
| Upstash         | In the database's connection details copy the `rediss://` (TCP) URL |
| Redis Cloud     | `rediss://default:<password>@<host>:<port>` from the database page  |
| AWS ElastiCache | `rediss://<endpoint>:6379` (see the note below)                     |

Upstash and Redis Cloud both have a free tier; check their current limits. A sign-in or registration costs one to three Redis commands.

Notes:

- Use `rediss://` (two s) when the server requires TLS, which hosted services do.
- **ElastiCache** only accepts connections from inside its VPC, so Vercel cannot reach it directly. Use it when you host the app in the same AWS network; otherwise pick a hosted Redis with a public endpoint.
- Each server instance opens one connection. Free plans cap connections (Redis Cloud's free tier allows 30), so watch that limit if you expect many instances.
- If Redis is unreachable or slow, requests are never blocked: the limiter falls back to in-memory counters, logs `[rate-limit] Redis unavailable`, and retries Redis after ten seconds.
- Counters are stored under `splitlyst:rl:`. Email addresses are hashed before they are used in a key.
- `npm run test:connections` checks that Redis is reachable and accepts writes.

## Other services

- **Exchange rates:** a free key from [exchangerate-api.com](https://www.exchangerate-api.com/) in `EXCHANGE_RATE_API_KEY`. Without it the app falls back to fixed rates. Live rates are cached for an hour.
- **Uploads:** avatars and receipts go to Cloudinary. Set the three `CLOUDINARY_*` variables to enable them.
- **Pooled databases:** if `DATABASE_URL` points at a pgbouncer pooler, set `DIRECT_URL` to the direct connection and use it for `prisma db push`.
