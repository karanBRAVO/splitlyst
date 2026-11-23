# Features

Splitlyst has no paid tiers, expense caps or ads. Everything below is available to every user.

## Accounts & security

| Feature                | Description                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**               | Email + password signup/login with JWT sessions (30-day expiry)                                                                                                                                                                  |
| **Google sign-in**     | Optional "Continue with Google" (enabled when `GOOGLE_CLIENT_ID/SECRET` are set)                                                                                                                                                 |
| **Email verification** | Verification link emailed on sign-up; banner + "Resend" until verified (non-blocking)                                                                                                                                            |
| **Two-factor auth**    | TOTP (Google Authenticator, Authy, 1Password…) with QR setup and 8 single-use recovery codes                                                                                                                                     |
| **Password reset**     | Reset link is **emailed** (Gmail SMTP or Resend). Without email configured, the link is only shown in local dev                                                                                                                  |
| **Rate limiting**      | Sign-up, password reset, email verification, 2FA codes and reminders are rate limited. Failed sign-ins are throttled per account and per IP. Counters are shared through Redis when `REDIS_URL` is set, otherwise kept in memory |
| **Account deletion**   | Password-confirmed; personal data removed, shared history anonymised as "Deleted user"                                                                                                                                           |
| **Profile**            | Avatar (Cloudinary), phone, bio, timezone, default currency, change password                                                                                                                                                     |
| **Payment handles**    | Optional Venmo / PayPal.me / UPI ID shown to friends who owe you                                                                                                                                                                 |
| **Languages**          | English, Español, Français, Deutsch, हिन्दी — navigation and key labels (Settings → Preferences)                                                                                                                                  |

## Friends & groups

| Feature             | Description                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Friend requests** | Send by email → recipient accepts or declines; sent requests can be cancelled                                                                                                                                             |
| **Groups**          | Create, edit, delete; add members by email; admin role                                                                                                                                                                    |
| **Invite links**    | Admins copy / revoke a `/join/<code>` link; anyone logged in can join                                                                                                                                                     |
| **Leave group**     | Blocked while you have unsettled balances or if you are the last admin of others                                                                                                                                          |
| **Simplify debts**  | Per-group toggle: minimum-payment suggestions, or the plain "who owes whom" list                                                                                                                                          |
| **Default split**   | Per-group default (equal / percentage / shares) that pre-fills new expenses                                                                                                                                               |
| **Archive groups**  | Archive hides a group and blocks new expenses; restore from the **Archived** tab                                                                                                                                          |
| **Import**          | Import a Splitwise CSV export into a group: preview first, then one atomic bulk insert (up to 5,000 rows). Handles US `M/D/YY` dates, "Payment" and "Settle all balances" rows, and groups with more people than the file |

## Expenses & money

| Feature              | Description                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Expenses**         | Add, edit, delete with description, date, category, notes                                                                                                                      |
| **Itemised splits**  | Add line items, assign each to people, and share tax & tip in proportion to what was ordered                                                                                   |
| **Split types**      | Equal · Percentage · Shares · Custom amounts                                                                                                                                   |
| **Receipts**         | Attach a receipt image to an expense; shown on the expense page                                                                                                                |
| **Recurring**        | "Repeat this expense" (daily/weekly/monthly/yearly); a daily cron creates the copies                                                                                           |
| **Currency display** | Every amount shows its own symbol; foreign amounts also show "≈ …" in your preferred currency                                                                                  |
| **Multi-currency**   | 20+ currencies with live conversion to your preferred currency                                                                                                                 |
| **Balances**         | Real-time balances across groups and friends                                                                                                                                   |
| **Smart settle-up**  | Minimum-transaction debt simplification                                                                                                                                        |
| **Activity feed**    | Grouped by day with filters; shows who did what, amounts, and your effect ("you lent" / "you owe")                                                                             |
| **Payments**         | Calculated, not typed: the amount is the outstanding balance (read-only) and the server rejects anything above it; either person can record it; full **Payments** history page |
| **Pay links**        | Venmo / PayPal / UPI deep links when you owe a friend who saved a handle                                                                                                       |
| **Reminders**        | Nudge someone who owes you (in-app + email; 1 per person per hour)                                                                                                             |
| **Comments**         | Per-expense comment threads                                                                                                                                                    |
| **Search & filter**  | Filter expenses by keyword and category                                                                                                                                        |
| **Analytics**        | Monthly spending, category breakdown, trends (Recharts)                                                                                                                        |
| **Offline entry**    | Expenses added without a connection are saved on the device and synced when you're back online                                                                                 |
| **Export**           | Download expenses as CSV or JSON, optionally for a date range                                                                                                                  |

## Notifications

| Feature      | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| **In-app**   | Expenses, payments, friend requests, reminders, activity feed                            |
| **Email**    | New-expense and reminder emails when an email provider (SMTP or Resend) is configured    |
| **Web push** | Optional push notifications on each device (VAPID keys required; Settings → Preferences) |
| **PWA**      | Installable on iOS/Android; static assets cached                                         |

## Known gaps

Splitlyst covers the day-to-day core of Splitwise, but it is not a one-to-one clone. What is missing:

- **Native iOS/Android apps** — it's an installable PWA instead.
- **Editing an expense in the UI** — the API supports it (`PATCH /api/expenses/:id`) but there is no edit screen yet; delete and re-add.
- **Group settings screen** — renaming a group / changing its currency or avatar, and promoting/demoting admins, are API-only or missing.
- **People without an account** — friends and group members must already be registered; there are no email invites or placeholder members.
- **Partial payments** — the settle-up amount is calculated and fixed to the full outstanding balance.
- **Separate balances per currency** — amounts are converted into one currency instead of tracked per currency.
- **Receipt OCR / auto-itemising**, **bank transaction import** and **in-app payments** (Venmo/PayPal/UPI are deep links only).
- **Email change**, **comment edit/delete**, **notification preferences** (which emails/pushes you want), and **real-time sync** between devices.
