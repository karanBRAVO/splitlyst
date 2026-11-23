# Getting started

This page takes you from a fresh clone to a running local app.

## Prerequisites

### Node.js 24

The project requires Node.js 24 and npm 11. The version is pinned in `.nvmrc`, so with [nvm](https://github.com/nvm-sh/nvm) you only need:

```bash
nvm install   # reads .nvmrc
nvm use
node --version   # v24.x.x
```

### PostgreSQL

Any PostgreSQL 14+ database works:

| Option             | Notes                                                           |
| ------------------ | --------------------------------------------------------------- |
| Supabase           | Free tier; works well with Vercel. <https://supabase.com>       |
| Neon               | Serverless Postgres. <https://neon.tech>                        |
| Railway            | Hosted Postgres with a free allowance. <https://railway.app>    |
| Docker             | `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16` |
| Local installation | `brew install postgresql@16`                                    |

## Install and run

```bash
git clone https://github.com/karanBRAVO/splitlyst.git
cd splitlyst

nvm use
npm install

cp .env.example .env     # then edit .env

npm run db:push          # create the tables
npm run db:seed          # optional: demo data
npm run icons            # generate the PWA icons
npm run dev
```

Open <http://localhost:3000>.

In `.env`, set at least `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` and `CRON_SECRET`. Everything else is optional; see [Configuration](configuration.md).

## Database

Prisma 7 keeps the datasource URL out of `schema.prisma`. It is read in `prisma.config.ts`, which loads `.env` with Node's built-in `process.loadEnvFile()`, so no `dotenv` package is needed.

| Command               | What it does                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:push`     | Creates or updates tables from `prisma/schema.prisma` without a migration file. Use it for local development and first deploys. |
| `npm run db:migrate`  | Creates a versioned migration in `prisma/migrations/` and applies it. Commit the generated files.                               |
| `npm run db:studio`   | Opens Prisma Studio, a browser UI for the data, at <http://localhost:5555>.                                                     |
| `npm run db:seed`     | Inserts the [demo accounts](#demo-accounts) and sample data.                                                                    |
| `npm run db:generate` | Regenerates the Prisma client. This also runs on `npm install` and before every build.                                          |

Prisma Studio does not work on Node 22 or newer (`ERR_STREAM_UNABLE_TO_PIPE`). Run it with an older Node: `nvm exec 20 npx prisma studio`.

## Demo accounts

After `npm run db:seed`:

| Email               | Password   | Notes       |
| ------------------- | ---------- | ----------- |
| `alice@example.com` | `demo1234` | Group admin |
| `bob@example.com`   | `demo1234` | Member      |
| `carol@example.com` | `demo1234` | Member      |

The seed creates a "Paris Trip 2024" group with three shared expenses and one personal split between Alice and Bob. Do not run it against a production database.

## Everyday commands

```bash
npm run dev            # development server (Turbopack)
npm run build          # production build
npm run start          # serve the production build
npm run lint           # ESLint
npm run format         # Prettier, write changes
npm run test           # unit and API tests
```

Before you start the app, `npm run test:connections` checks that the database, the exchange-rate API and email are reachable. See [Testing](testing.md#connection-checks).
