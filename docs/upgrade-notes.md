# Upgrade notes

Changes between releases, newest first. After pulling a release that changes the schema, run `npm run db:push` (or `npm run db:migrate` if you use migrations).

## 0.1.0: first release

This is the first public release, so there is nothing to upgrade from. If you are setting up a new instance, start with [Getting started](getting-started.md).

### Things to know

- **Environment variables.** `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` and `CRON_SECRET` are required. Email, Google sign-in, web push, Cloudinary uploads and live exchange rates are optional. See [Configuration](configuration.md).
- **Set `REDIS_URL` in production.** It makes rate limits, including the sign-in lockout, shared across serverless instances. Any Redis works (see [Configuration](configuration.md#rate-limiting-and-redis)). Without it the app still runs, with per-instance limits.
- **Sign-in is throttled.** Ten failed attempts for one account, or thirty from one IP, lock sign-in for 15 minutes.
- **Do not put `NODE_ENV` in `.env`.** Next.js sets it itself, and a `development` value breaks production builds.
- **Payments are calculated.** The settle-up amount and currency are read-only. `POST /api/payments` rejects an amount above what the payer owes, and a payment between two other people.
- **Imports are capped.** A Splitwise CSV import accepts up to 5,000 rows and inserts them in one atomic batch.
- **The recurring-expense job needs `CRON_SECRET`.** It only runs on Vercel production deployments. See [Deployment](deployment.md#cron-job).

### Technical notes for contributors

**Prisma 7: client engine and adapter.** Prisma 7 uses a TypeScript client engine with no Rust binary, so connecting to PostgreSQL needs `@prisma/adapter-pg`:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```

The datasource URL lives in `prisma.config.ts`, not in `schema.prisma`. Any script that creates a `PrismaClient`, such as the seed script, must pass the adapter too.

**Tailwind CSS 4: CSS-first configuration.** Colors, fonts and animations are defined in an `@theme { }` block in `app/globals.css`, not in `tailwind.config.ts`. `@apply` cannot reference custom classes from `@layer components`, so each variant spells out its own utilities.

**Next.js 16: `proxy.ts`.** The middleware entry point is `proxy.ts` (formerly `middleware.ts`). Route params are async, and `next lint` no longer exists, so linting runs `eslint .` directly.

**ESLint 10: flat config.** `eslint.config.mjs` spreads the flat config arrays exported by `eslint-config-next`. No `FlatCompat` wrapper is needed.
