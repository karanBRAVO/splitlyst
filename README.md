# Splitlyst

[![CI](https://github.com/karanBRAVO/splitlyst/actions/workflows/ci.yml/badge.svg)](https://github.com/karanBRAVO/splitlyst/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Splitlyst is an open-source app for sharing expenses with friends, housemates and travel groups. Add an expense, choose how to split it, and see who owes whom. It is a self-hostable alternative to Splitwise, built with Next.js and PostgreSQL, and it installs as a Progressive Web App.

## Features

- Groups and friends, with invite links and group archiving
- Equal, percentage, share, custom and itemised splits (tax and tip shared in proportion)
- Balances across groups and friends, with suggested payments that minimise the number of transfers
- 20+ currencies with live conversion
- Recurring expenses, receipts, comments, reminders and an activity feed
- Spending analytics, CSV/JSON export and Splitwise CSV import
- Email and Google sign-in, email verification, password reset and two-factor authentication
- Email, in-app and web push notifications
- Works offline: expenses added without a connection sync when you are back online
- English, Spanish, French, German and Hindi

The full list, including what is not built yet, is in [docs/features.md](docs/features.md).

## Quick start

You need Node.js 24 and a PostgreSQL database.

```bash
git clone https://github.com/karanBRAVO/splitlyst.git
cd splitlyst

nvm use
npm install

cp .env.example .env     # set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET

npm run db:push          # create the tables
npm run db:seed          # optional: demo data (alice@example.com / demo1234)
npm run dev
```

Open <http://localhost:3000>. [Getting started](docs/getting-started.md) has the details, and [Configuration](docs/configuration.md) covers email, Google sign-in and the other optional settings.

## Built with

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 7 with PostgreSQL, NextAuth.js, TanStack Query, and Jest and Playwright for tests. See [Architecture](docs/architecture.md).

## Scripts

| Command                    | Purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `npm run dev`              | Start the development server                           |
| `npm run build`            | Production build                                       |
| `npm test`                 | Unit and API tests                                     |
| `npm run test:e2e`         | Browser tests (needs a test database)                  |
| `npm run test:connections` | Check the database, exchange-rate API, email and Redis |
| `npm run lint`             | ESLint                                                 |
| `npm run format`           | Prettier                                               |

## Documentation

| Page                                       | What is in it                                       |
| ------------------------------------------ | --------------------------------------------------- |
| [Getting started](docs/getting-started.md) | Install, database setup, demo accounts              |
| [Configuration](docs/configuration.md)     | Environment variables, email, Google sign-in        |
| [Features](docs/features.md)               | Everything the app does, and known gaps             |
| [Architecture](docs/architecture.md)       | Project layout, data model, split and balance logic |
| [API reference](docs/api.md)               | HTTP endpoints                                      |
| [Testing](docs/testing.md)                 | Unit, e2e and connection tests; linting; CI         |
| [Deployment](docs/deployment.md)           | Vercel, cron job, installing as an app              |
| [Troubleshooting](docs/troubleshooting.md) | Common problems and fixes                           |
| [Upgrade notes](docs/upgrade-notes.md)     | Changes between releases                            |
| [Coding style](docs/coding-style.md)       | Conventions for contributors                        |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](docs/CONTRIBUTING.md) before opening a pull request. To report a vulnerability, follow [SECURITY.md](docs/SECURITY.md) rather than opening a public issue.

## License

[MIT](LICENSE)
