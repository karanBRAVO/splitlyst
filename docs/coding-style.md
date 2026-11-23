# Coding style

Prettier and ESLint enforce formatting and the basic rules, so you do not need to memorise them. This page records the conventions the code follows today that those tools cannot check. When in doubt, follow the code around you.

## Formatting and tooling

- Prettier decides layout: 100 columns, single quotes, semicolons, trailing commas, Tailwind classes sorted by `prettier-plugin-tailwindcss`. Run `npm run format`.
- ESLint uses the Next.js and TypeScript presets. `any` and unused variables are warnings: avoid `any`, and prefix a deliberately unused name with `_`.
- TypeScript is `strict`. Project files are imported through the `@/` alias (`@/lib/prisma`), never with `../`.
- A pre-commit hook formats and lints staged files, and CI runs the same checks.

## Files and naming

| Kind                  | Convention                                             | Example                                          |
| --------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Modules in `lib/`     | kebab-case, one concern per file                       | `group-balance.ts`, `offline-queue.ts`           |
| Shared components     | kebab-case file, PascalCase export                     | `components/ui/money.tsx` exports `Money`        |
| Page-local components | PascalCase file next to the page                       | `app/(auth)/login/LoginForm.tsx`                 |
| Routes and pages      | Next.js file names                                     | `route.ts`, `page.tsx`                           |
| Tests                 | mirror the source folder, end in `.test.ts`/`.spec.ts` | `__tests__/lib/totp.test.ts`, `e2e/auth.spec.ts` |

## Structure

- Keep logic out of components. Money, splitting and balance rules live in `lib/` as plain functions so they can be unit-tested.
- When a module grows several implementations, make it a folder with an `index.ts` that exposes the public API. `lib/rate-limit/` is the example: a small `RateLimitStore` interface, a memory store, a Redis store and a fallback between them. Importers keep using `@/lib/rate-limit`.
- Helpers used by more than one module live in a shared module, not inside whichever file wrote them first. The connection checks in `scripts/connections/` keep their own logic, and common helpers such as `maskUrl` and `maskKey` live in `shared.ts`. One check does not import from another.

## React

- Most pages are client components (`'use client'`), because they depend on the session and on query data. Add the directive only to files that need state, effects or browser APIs.
- Pages that read search params keep a thin server `page.tsx` that renders the client form inside `<Suspense>` (`login`, `reset-password`, `expenses/new`).
- Server data is fetched with TanStack Query (`useQuery`, `useMutation`), and the affected query keys are invalidated after a mutation. One-off form submissions (register, forgot and reset password, the push toggle) use plain `fetch`.

## API routes

- **Auth.** Call `getAuth()` first and return `401` without a session. The routes without it are public by design: register, forgot and reset password, NextAuth, the currency lookup, and the cron job (which checks `CRON_SECRET` instead).
- **Validation.** Validate request bodies with Zod. Write routes call `schema.parse()` inside a `try`/`catch` and turn a `z.ZodError` into a `400`; newer routes use `safeParse`. Prefer `safeParse` in new code.
- **Responses.** Always JSON, errors as `{ error: 'message' }`. Status codes in use: `400` bad input, `401` not signed in, `403` not allowed, `404` not found, `409` conflict, `429` rate limited, `500` unexpected.
- **Failures.** Wrap writes that touch several tables in `try`/`catch`, log with a tag (`console.error('[expenses POST]', err)`) and return `500` with `{ error: 'Internal server error' }`.
- **Rate limiting.** Public and abusable endpoints call `await rateLimit(key, limit, windowMs)` and answer `429` with a `Retry-After` header. Sign-in failures are throttled in `lib/auth.ts`.
- **Money.** The server recomputes amounts and rejects totals that do not add up. It does not trust the client.

## Money and currency

- Amounts are stored with their original currency and converted only when displayed or summed (`convertAmount()`).
- Show amounts with the `<Money />` component or `formatCurrency()`, not a hard-coded symbol. The only literal `$` amounts are the demo cards on the landing page.
- Balances are computed from expenses and payments, never stored.

## User-facing text

Navigation and key labels go through `useT()` with keys in `lib/i18n.ts`. Add each new key to all five locales; a test fails if one is missing.

## Security and privacy

- Secrets are read from `process.env` only. Document every new variable in `.env.example` and [configuration.md](configuration.md).
- Do not log or return passwords, tokens, API keys or connection strings. Mask URLs before printing them (`maskUrl`).
- Keep personal data out of shared stores and logs. For example, rate-limit keys use a hash of the email, not the address.
- A failure in an optional service (email, Redis, push) must not break the request: catch it, log it, carry on.

## Tests

- New logic gets a unit test, a new user-facing flow gets a Playwright test, and every bug fix gets a regression test.
- Route tests mock `@/lib/prisma` and `@/lib/auth`, so they need no database. External services (Redis, SMTP) are replaced with fakes. Where a fake could hide a real difference, add an integration test that runs only when the service is available, such as `redis.integration.test.ts`.
- E2E tests create their own users directly in the database (`createUser` in `e2e/helpers.ts`) with unique emails, so tests do not depend on each other or on leftover data.
- Name a test for the behaviour it protects: `locks an account after 10 wrong passwords`, not `test login 2`.

## Commits and pull requests

See [CONTRIBUTING.md](CONTRIBUTING.md): short prefixed messages (`feat:`, `fix:`, `docs:`, `chore:`), one change per pull request, and the matching docs updated in the same pull request.
