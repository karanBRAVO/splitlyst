# Contributing

Thanks for your interest in Splitlyst. Bug reports, fixes, documentation and features are all welcome. For anything larger than a small fix, open an issue first so we can agree on the approach before you spend time on it.

## Set up

Follow [Getting started](getting-started.md). Use a separate database for development. The end-to-end tests create and delete users in whichever database `DATABASE_URL` points to.

## Branches

- `master` is the released code. `qa` and `dev` are integration branches. All three are protected, so changes go in through pull requests.
- Branch from `dev` and name your branch for what it does: `feature/...`, `fix/...`, `docs/...`.
- Open your pull request against `dev`.

## Making a change

1. Write the code and its tests. New logic needs a unit test; user-facing flows need a Playwright test.
2. Run the checks that apply to what you changed:

   ```bash
   npm run lint
   npm run format:check
   npx tsc --noEmit
   npm test
   npm run build
   ```

   For browser tests, run only the files you touched, for example `npx playwright test e2e/auth.spec.ts`.

3. Update the documentation. See [Which docs to update](#which-docs-to-update).
4. Commit and open a pull request.

A pre-commit hook formats and lints staged files automatically. The same checks run in CI, and a pull request needs a green build before it can be merged.

## Which docs to update

Change the doc in the same pull request as the code. Use this table to find it:

| If you change...                                                                                 | Update                                                                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| An environment variable, or how email, Google sign-in or push is set up                          | [configuration.md](configuration.md) and `.env.example`                             |
| Install steps, prerequisites, database commands or demo data                                     | [getting-started.md](getting-started.md)                                            |
| A user-visible feature, or a known gap you closed or found                                       | [features.md](features.md), and the README feature list if it is a headline feature |
| An API route (path, parameters, response)                                                        | [api.md](api.md)                                                                    |
| Folders, database models, split types or balance logic                                           | [architecture.md](architecture.md)                                                  |
| An npm script, a test type or the CI workflow                                                    | [testing.md](testing.md), and the README scripts table                              |
| Deploy steps, Vercel settings or the cron job                                                    | [deployment.md](deployment.md)                                                      |
| A problem users hit, with its fix                                                                | [troubleshooting.md](troubleshooting.md)                                            |
| Anything that affects people upgrading: schema changes, breaking changes, new required variables | [upgrade-notes.md](upgrade-notes.md), under the next version                        |
| A convention, or the way routes, tests or modules are structured                                 | [coding-style.md](coding-style.md)                                                  |
| Security-relevant behaviour or deployment advice                                                 | [SECURITY.md](SECURITY.md)                                                          |

If a change fits none of these, it probably needs no documentation. If it fits several, update each one.

## Commit messages

Use a short prefix and an imperative summary, as in the existing history:

```text
feat: add Google sign-in button to the register page
fix: reject payments above the outstanding balance
docs: split the README into docs/
chore: bump dependencies
```

Add a few lines of body when the reason is not obvious from the diff.

## Pull requests

- Keep each pull request to one change.
- Describe what changed and why, and how you tested it.
- Include screenshots for visible UI changes, on both desktop and mobile widths.
- Never commit secrets or `.env` files. Only `.env.example` belongs in the repository.

## Code style

Prettier and ESLint handle formatting (`prettier.config.mjs`, `eslint.config.mjs`); run `npm run format` if the hook has not already. For conventions they cannot check, such as API route structure, naming, money handling and what never to log, read the [coding style guide](coding-style.md).

## Security issues

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contribution is released under the [MIT License](../LICENSE).
