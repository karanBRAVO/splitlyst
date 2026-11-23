# API reference

All API routes are under `/api`. All protected routes require a valid session cookie (set automatically by NextAuth).

## Auth

| Method | Route                           | Description                                |
| ------ | ------------------------------- | ------------------------------------------ |
| `POST` | `/api/auth/register`            | Create account `{ name, email, password }` |
| `POST` | `/api/auth/[...nextauth]`       | NextAuth sign-in / sign-out / session      |
| `POST` | `/api/auth/forgot-password`     | Send password reset email `{ email }`      |
| `GET`  | `/api/auth/verify-email?token=` | Confirm email from the emailed link        |
| `POST` | `/api/auth/verify-email`        | Resend verification email (signed in)      |
| `POST` | `/api/auth/reset-password`      | Apply new password `{ token, password }`   |

## Groups

| Method   | Route                     | Description                                                              |
| -------- | ------------------------- | ------------------------------------------------------------------------ |
| `GET`    | `/api/groups`             | List groups for current user (`?archived=true` for archived)             |
| `POST`   | `/api/groups`             | Create group `{ name, description?, currency, category, memberEmails? }` |
| `GET`    | `/api/groups/:id`         | Group detail with members, expenses, counts                              |
| `PATCH`  | `/api/groups/:id`         | Update group, `simplifyDebts`, `defaultSplit`, `isArchived` (admin only) |
| `DELETE` | `/api/groups/:id`         | Delete group (admin only)                                                |
| `POST`   | `/api/groups/:id/members` | Add member by email (admin only)                                         |
| `DELETE` | `/api/groups/:id/members` | Remove member / leave `{ userId }` (blocked while unsettled)             |
| `POST`   | `/api/groups/:id/invite`  | Create or rotate the invite link code (admin only)                       |
| `DELETE` | `/api/groups/:id/invite`  | Revoke the invite link (admin only)                                      |
| `GET`    | `/api/groups/join/:code`  | Preview the group behind an invite link                                  |
| `POST`   | `/api/groups/join/:code`  | Join the group via invite link                                           |
| `POST`   | `/api/import`             | Import Splitwise CSV `{ groupId, csv, dryRun?, mapping? }`               |

## Expenses

| Method   | Route                        | Description                                                                                                                                                           |
| -------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/expenses`              | List expenses `?groupId= &friendId= &search= &category= &limit=`                                                                                                      |
| `POST`   | `/api/expenses`              | Create expense with splits (`receiptUrl?`, `isRecurring?`, `recurringInterval?`; `splitType: "itemized"` takes `items[{name, amount, assignedTo[]}]`, `tax?`, `tip?`) |
| `GET`    | `/api/expenses/:id`          | Expense detail with splits, comments, attachments                                                                                                                     |
| `PATCH`  | `/api/expenses/:id`          | Update expense (payer only)                                                                                                                                           |
| `DELETE` | `/api/expenses/:id`          | Delete expense (payer only)                                                                                                                                           |
| `POST`   | `/api/expenses/:id/comments` | Add comment `{ text }`                                                                                                                                                |

## Payments & Balances

| Method | Route                    | Description                                                                                                         |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/payments`          | List payments `?groupId=`                                                                                           |
| `POST` | `/api/payments`          | Record payment `{ payerId?, receiverId, amount, currency, groupId?, notes? }` — amount must not exceed what is owed |
| `POST` | `/api/reminders`         | Remind someone to settle up `{ userId }` (1/hour per person)                                                        |
| `GET`  | `/api/balances`          | Overall balances converted to user's preferred currency                                                             |
| `GET`  | `/api/balances?groupId=` | Group balances converted to group's currency + simplified debts                                                     |

## Social

| Method   | Route              | Description                                        |
| -------- | ------------------ | -------------------------------------------------- |
| `GET`    | `/api/friends`     | List friends and requests (`status`, `isIncoming`) |
| `POST`   | `/api/friends`     | Send a friend request by email `{ email }`         |
| `PATCH`  | `/api/friends/:id` | Accept a pending request (recipient only)          |
| `DELETE` | `/api/friends/:id` | Remove friend / decline / cancel request           |

## Misc

| Method   | Route                                | Description                                                            |
| -------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `GET`    | `/api/activity`                      | Activity feed `?groupId= &limit=`                                      |
| `GET`    | `/api/notifications`                 | All notifications                                                      |
| `GET`    | `/api/notifications?unreadOnly=true` | Unread count `{ count }`                                               |
| `PATCH`  | `/api/notifications`                 | Mark read `{ id }` or `?markAllRead=true`                              |
| `GET`    | `/api/analytics?months=`             | Spending stats (monthly, category, top expenses)                       |
| `GET`    | `/api/currency?from=&to=&amount=`    | FX rate conversion                                                     |
| `GET`    | `/api/export?type=csv`               | Download CSV (`&from=YYYY-MM-DD&to=YYYY-MM-DD` optional)               |
| `GET`    | `/api/export?type=json`              | Download expenses as JSON                                              |
| `POST`   | `/api/upload`                        | Upload image (`folder=avatars\|receipts`) → URL                        |
| `GET`    | `/api/cron/recurring`                | Create due recurring expenses (needs `CRON_SECRET` bearer)             |
| `GET`    | `/api/users/me`                      | Current user profile                                                   |
| `PATCH`  | `/api/users/me`                      | Update profile, currency, timezone, payment handles, or password       |
| `POST`   | `/api/users/me/2fa`                  | `{action: setup\|enable\|disable, code?, password?}` — TOTP two-factor |
| `GET`    | `/api/push`                          | Push config `{ enabled, publicKey }`                                   |
| `POST`   | `/api/push`                          | Save a push subscription (`PushSubscription` JSON)                     |
| `DELETE` | `/api/push`                          | Remove a subscription `{ endpoint }`                                   |
| `DELETE` | `/api/users/me`                      | Delete (anonymise) account `{ password }`                              |
