import { expect, test } from '@playwright/test';
import {
  addEqualExpense,
  api,
  createGroup,
  createUser,
  getBalance,
  sessionFor,
  type TestUser,
} from './helpers';

// One long scenario: friends → group → expenses → balances → reminders → settle up → leave → invite → archive.
test.describe.serial('friends, groups, expenses and settle-up', () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let groupId: string;

  test.beforeAll(async () => {
    alice = await createUser('Alice');
    bob = await createUser('Bob');
    carol = await createUser('Carol');
  });

  test('friend request: send, see pending, accept', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto('/friends');
    await a.page.getByRole('button', { name: 'Add Friend' }).first().click();
    await a.page.getByPlaceholder('friend@example.com').fill(bob.email);
    await a.page.getByRole('button', { name: 'Send Request' }).click();
    await expect(a.page.getByText('Friend request sent!')).toBeVisible();
    await expect(a.page.getByText('Sent requests')).toBeVisible();

    const b = await sessionFor(browser, bob);
    await b.page.goto('/friends');
    await expect(b.page.getByText('Friend requests')).toBeVisible();
    await expect(b.page.getByText('Alice').first()).toBeVisible();
    await b.page.getByRole('button', { name: 'Accept' }).click();
    await expect(b.page.getByText('Friend request accepted')).toBeVisible();
    await expect(b.page.getByText('Friend requests')).toHaveCount(0);

    // Alice's pending section disappears once accepted; she is notified
    await a.page.reload();
    await expect(a.page.getByText('Sent requests')).toHaveCount(0);
    const notes = await api<Array<{ type: string }>>(a.page, 'get', '/api/notifications');
    expect(notes.body.some((n) => n.type === 'friend_added')).toBe(true);

    // A requester cannot accept their own request / duplicate requests are refused
    const dup = await api(a.page, 'post', '/api/friends', { email: bob.email });
    expect(dup.status).toBe(409);
    await a.context.close();
    await b.context.close();
  });

  test('create a group with members and add an equal-split expense', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    groupId = await createGroup(a.page, 'Flatmates', [bob.email]);
    await expect(a.page.getByRole('heading', { name: 'Flatmates' })).toBeVisible();

    await addEqualExpense(a.page, groupId, 'Groceries', '60');
    expect(await getBalance(a.page, groupId)).toMatchObject({ Alice: 30, Bob: -30 });
    await a.context.close();
  });

  test('itemized expense splits items, tax and tip fairly', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto(`/expenses/new?groupId=${groupId}`);
    await a.page.getByPlaceholder('e.g. Dinner, Netflix, Rent...').fill('Restaurant');
    // wait until the group's members have loaded (the submit button stays disabled until then)
    await expect(a.page.getByRole('button', { name: 'Add Expense' })).toBeEnabled();
    await a.page.getByText('itemized', { exact: true }).click();
    await expect(a.page.getByTestId('itemized-editor')).toBeVisible();

    // Item 1: pizza $30 → Alice only; Item 2: salad $10 → Bob only
    await a.page.getByTestId('add-item').click();
    await a.page.getByTestId('item-name').nth(0).fill('Pizza');
    await a.page.getByTestId('item-amount').nth(0).fill('30');
    await a.page.getByTestId('assign-Bob').nth(0).click(); // un-assign Bob

    await a.page.getByTestId('add-item').click();
    await a.page.getByTestId('item-name').nth(1).fill('Salad');
    await a.page.getByTestId('item-amount').nth(1).fill('10');
    await a.page.getByTestId('assign-Alice').nth(1).click(); // un-assign Alice (the "You" chip)
    await a.page.getByTestId('tax').fill('4');
    await a.page.getByTestId('tip').fill('8');

    // total mirrors items + tax + tip = 52
    await expect(a.page.locator('input[name="amount"]')).toHaveValue('52.00');
    await a.page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(a.page).toHaveURL(new RegExp(`/groups/${groupId}`));

    // Bob owes 30 (earlier) + 13 (10 salad + 25% of 12 extras → 3) = 43; Alice paid 52
    const bal = await getBalance(a.page, groupId);
    expect(bal.Bob).toBeCloseTo(-43, 2);
    expect(bal.Alice).toBeCloseTo(43, 2);

    // The detail page shows the breakdown
    const list = await api<Array<{ id: string; description: string }>>(
      a.page,
      'get',
      `/api/expenses?groupId=${groupId}`,
    );
    const expense =
      (list.body as unknown as { expenses?: Array<{ id: string; description: string }> })
        .expenses ?? list.body;
    const id = (expense as Array<{ id: string; description: string }>).find(
      (e) => e.description === 'Restaurant',
    )!.id;
    await a.page.goto(`/expenses/${id}`);
    await expect(a.page.getByTestId('items-breakdown')).toContainText('Pizza');
    await expect(a.page.getByTestId('items-breakdown')).toContainText('Salad');
    await expect(a.page.getByTestId('items-breakdown')).toContainText('Tax');
    await expect(a.page.getByTestId('items-breakdown')).toContainText('Tip');
    await a.context.close();
  });

  test('server rejects itemized expenses whose total does not add up', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const res = await api(a.page, 'post', '/api/expenses', {
      description: 'Bad',
      amount: 99,
      currency: 'USD',
      paidById: alice.id,
      groupId,
      splitType: 'itemized',
      participants: [alice.id, bob.id],
      items: [{ name: 'x', amount: 10, assignedTo: [alice.id] }],
    });
    expect(res.status).toBe(400);
    await a.context.close();
  });

  test('simplify-debts toggle and default split via group settings', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto(`/groups/${groupId}`);

    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Turn off simplify debts').click();
    await expect(a.page.getByText('Group settings updated')).toBeVisible();
    const off = await api<{ simplifyDebts: boolean }>(
      a.page,
      'get',
      `/api/balances?groupId=${groupId}`,
    );
    expect(off.body.simplifyDebts).toBe(false);

    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Turn on simplify debts').click();
    await expect(a.page.getByText('Group settings updated').first()).toBeVisible();

    // Default split 75/25 → pre-fills new group expenses
    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Default split', { exact: true }).click();
    await a.page.getByTestId('ds-type').selectOption('percentage');
    await a.page.getByTestId('ds-Alice').fill('75');
    await a.page.getByTestId('ds-Bob').fill('25');
    await a.page.getByTestId('ds-save').click();
    await expect(a.page.getByText('Default split saved')).toBeVisible();

    await a.page.goto(`/expenses/new?groupId=${groupId}`);
    await expect(a.page.locator('input[name="splitType"][value="percentage"]')).toBeChecked();
    await expect(a.page.locator('input[type="number"][placeholder="0%"]').first()).toHaveValue(
      '75',
    );

    // invalid percentages are refused by the API
    const bad = await api(a.page, 'patch', `/api/groups/${groupId}`, {
      defaultSplit: { type: 'percentage', values: { [alice.id]: 50, [bob.id]: 10 } },
    });
    expect(bad.status).toBe(400);
    await api(a.page, 'patch', `/api/groups/${groupId}`, { defaultSplit: null });
    await a.context.close();
  });

  test('activity feed explains who did what and what it means for you', async ({ browser }) => {
    const b = await sessionFor(browser, bob);
    await b.page.goto('/activity');
    const feed = b.page.getByTestId('activity-feed');
    await expect(feed).toBeVisible();
    await expect(feed.getByText('Today')).toBeVisible();

    // Alice paid for groceries (60 split 50/50): Bob owes his 30
    const groceries = feed.getByTestId('activity-item').filter({ hasText: 'Groceries' });
    await expect(groceries).toContainText('Alice');
    await expect(groceries).toContainText('added');
    await expect(groceries).toContainText('you owe');
    await expect(groceries).toContainText('$30.00');

    // Notifications stay listed (they don't vanish once read)
    await expect(b.page.getByTestId('notifications')).toBeVisible();
    await b.page.waitForTimeout(3500); // auto mark-as-read
    await b.page.reload();
    await expect(b.page.getByTestId('notifications')).toBeVisible();

    // From Alice's side the same expense is "you lent"
    const a = await sessionFor(browser, alice);
    await a.page.goto('/activity');
    const mine = a.page
      .getByTestId('activity-feed')
      .getByTestId('activity-item')
      .filter({ hasText: 'Groceries' });
    await expect(mine).toContainText('You');
    await expect(mine).toContainText('you lent');
    await expect(mine).toContainText('$30.00');

    // Filters
    await a.page.getByRole('tab', { name: 'Payments' }).click();
    await expect(a.page.getByText('No payments activity')).toBeVisible();
    await a.page.getByRole('tab', { name: 'Expenses' }).click();
    await expect(a.page.getByTestId('activity-item').first()).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('reminder: Alice nudges Bob (rate limited), Bob gets a notification', async ({
    browser,
  }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto('/friends');
    await a.page.getByTitle('Send a reminder').click();
    await expect(a.page.getByText('Reminder sent')).toBeVisible();

    const again = await api(a.page, 'post', '/api/reminders', { userId: bob.id });
    expect(again.status).toBe(429);

    const b = await sessionFor(browser, bob);
    const notes = await api<Array<{ type: string }>>(b.page, 'get', '/api/notifications');
    expect(notes.body.some((n) => n.type === 'payment_reminder')).toBe(true);
    await a.context.close();
    await b.context.close();
  });

  test('leaving is blocked while unsettled; settle up via the UI; then Bob can leave', async ({
    browser,
  }) => {
    const b = await sessionFor(browser, bob);
    const blocked = await api<{ error: string }>(
      b.page,
      'delete',
      `/api/groups/${groupId}/members`,
      {
        userId: bob.id,
      },
    );
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/Settle up/);

    // Settle from the group's Balances tab ("Pay" link carries the group id and amount)
    await b.page.goto(`/groups/${groupId}`);
    await b.page.getByRole('button', { name: 'Balances' }).click();
    await b.page.getByRole('link', { name: 'Pay', exact: true }).click();
    await expect(b.page).toHaveURL(/type=payment.*groupId=/);

    // The amount is calculated from the balance: it can't be edited, and neither can the currency
    const amountInput = b.page.locator('input[name="amount"]');
    await expect(amountInput).toHaveValue('43.00');
    await expect(amountInput).toHaveAttribute('readonly', '');
    await expect(b.page.getByTestId('payment-summary')).toContainText('You');
    await expect(b.page.getByTestId('payment-summary')).toContainText('Alice');
    await expect(b.page.locator('select[name="currency"]')).toHaveCount(0);

    // ...and the server refuses a tampered amount
    const tampered = await api<{ error: string }>(b.page, 'post', '/api/payments', {
      receiverId: alice.id,
      amount: 9999,
      currency: 'USD',
      groupId,
    });
    expect(tampered.status).toBe(400);
    expect(tampered.body.error).toMatch(/outstanding/);
    await b.page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(b.page.getByText('Payment recorded!')).toBeVisible();
    await expect(b.page).toHaveURL(new RegExp(`/groups/${groupId}`));

    expect(await getBalance(b.page, groupId)).toMatchObject({ Alice: 0, Bob: 0 });

    // Payments history page lists it
    await b.page.goto('/payments');
    await expect(b.page.getByText('You').first()).toBeVisible();
    await expect(b.page.getByText('$43.00')).toBeVisible();

    // Now Bob can leave (UI confirm dialog)
    await b.page.goto(`/groups/${groupId}`);
    b.page.once('dialog', (d) => d.accept());
    await b.page.locator('[data-testid="group-menu"]:visible').click();
    await b.page.getByText('Leave group').click();
    await expect(b.page).toHaveURL(/\/groups$/);
    await b.context.close();
  });

  test('invite link: admin creates, Carol joins, admin revokes', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const created = await api<{ inviteCode: string }>(
      a.page,
      'post',
      `/api/groups/${groupId}/invite`,
    );
    expect(created.status).toBe(200);
    const code = created.body.inviteCode;

    const c = await sessionFor(browser, carol);
    await c.page.goto(`/join/${code}`);
    await expect(c.page.getByRole('heading', { name: 'Flatmates' })).toBeVisible();
    await c.page.getByRole('button', { name: 'Join group' }).click();
    await expect(c.page).toHaveURL(new RegExp(`/groups/${groupId}`));

    // Non-admins can't create links and can't see the code
    const forbidden = await api(c.page, 'post', `/api/groups/${groupId}/invite`);
    expect(forbidden.status).toBe(403);
    const asMember = await api<{ inviteCode?: string }>(c.page, 'get', `/api/groups/${groupId}`);
    expect(asMember.body.inviteCode).toBeUndefined();

    await a.page.goto(`/groups/${groupId}`);
    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Revoke invite link').click();
    await expect(a.page.getByText('Invite link revoked')).toBeVisible();

    await c.page.goto(`/join/${code}`);
    await expect(c.page.getByText('Invite not available')).toBeVisible();
    await a.context.close();
    await c.context.close();
  });

  test('archive: blocks new expenses, appears under Archived, restores', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto(`/groups/${groupId}`);
    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Archive group').click();
    await expect(a.page).toHaveURL(/\/groups$/);
    await expect(a.page.getByText('Flatmates')).toHaveCount(0);

    await a.page.getByRole('button', { name: 'Archived' }).click();
    await expect(a.page.getByText('Flatmates')).toBeVisible();

    const blocked = await api<{ error: string }>(a.page, 'post', '/api/expenses', {
      description: 'Nope',
      amount: 5,
      currency: 'USD',
      paidById: alice.id,
      groupId,
      splitType: 'equal',
      participants: [alice.id],
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/archived/i);

    await a.page.getByText('Flatmates').click();
    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Unarchive group').click();
    await expect(a.page.getByText('Group restored')).toBeVisible();
    await a.page.goto('/groups');
    await expect(a.page.getByText('Flatmates')).toBeVisible();
    await a.context.close();
  });
});
