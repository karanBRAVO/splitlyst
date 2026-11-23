# Security policy

## Reporting a vulnerability

Please do not report security problems in a public issue or pull request.

Use GitHub's private reporting instead: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, the steps to reproduce it, and the impact you expect.

You can expect an acknowledgement within a few days. Splitlyst is maintained by volunteers, so fix times vary with severity. You will be told when a fix is released, and credited if you wish.

## Supported versions

Only the latest code on `master` receives security fixes.

## Deploying safely

If you host your own instance:

- Generate a new `NEXTAUTH_SECRET`, `CRON_SECRET` and VAPID key pair for every environment. Never reuse the examples from `.env.example`.
- Keep `.env` files out of version control. Set production values in your hosting provider's dashboard.
- Use a dedicated database for production, and do not run the demo seed or the end-to-end tests against it.
- Use an app password for Gmail SMTP, not the account password.
- Set `REDIS_URL` in production so rate limits are shared across server instances, and use a `rediss://` (TLS) URL for a hosted Redis. Without it, the sign-in lockout only counts attempts that reach the same instance.
