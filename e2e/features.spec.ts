import { expect, test } from '@playwright/test';
import {
  api,
  createGroup,
  createUser,
  login,
  prisma,
  sessionFor,
  PASSWORD,
  type TestUser,
} from './helpers';

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('expense features', () => {
  let alice: TestUser;
  let bob: TestUser;

  test.beforeAll(async () => {
    alice = await createUser('Anna');
    bob = await createUser('Ben');
  });

  test('receipt: attach an image to an expense and see it on the detail page', async ({
    browser,
  }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto('/expenses/new');
    await a.page.getByPlaceholder('e.g. Dinner, Netflix, Rent...').fill('Coffee beans');
    await a.page.locator('input[name="amount"]').fill('12.50');
    await a.page.locator('input[type="file"]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(a.page.getByText('Receipt attached')).toBeVisible();
    await a.page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(a.page.getByText('Expense added!')).toBeVisible();

    const exp = await prisma.expense.findFirstOrThrow({
      where: { description: 'Coffee beans', paidById: alice.id },
    });
    expect(exp.receiptUrl).toBeTruthy();
    await a.page.goto(`/expenses/${exp.id}`);
    await expect(a.page.getByRole('heading', { name: 'Receipt' })).toBeVisible();
    await expect(a.page.getByAltText('Receipt')).toBeVisible();
    await a.context.close();
  });

  test('uploads reject non-images', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const res = await a.page.request.post('/api/upload', {
      multipart: { file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') } },
    });
    expect(res.status()).toBe(400);
    await a.context.close();
  });

  test('offline: expense is queued and synced when the connection returns', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto('/expenses/new');
    await a.page.getByPlaceholder('e.g. Dinner, Netflix, Rent...').fill('Offline snack');
    await a.page.locator('input[name="amount"]').fill('7.25');

    await expect(a.page.getByRole('button', { name: 'Add Expense' })).toBeEnabled();
    await a.context.setOffline(true);
    await a.page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(a.page.getByText('Saved offline')).toBeVisible();
    expect(
      await prisma.expense.count({ where: { description: 'Offline snack', paidById: alice.id } }),
    ).toBe(0);

    await a.context.setOffline(false);
    await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(a.page.getByText(/Synced 1 offline expense/).first()).toBeVisible();
    await expect
      .poll(() =>
        prisma.expense.count({ where: { description: 'Offline snack', paidById: alice.id } }),
      )
      .toBe(1);
    await a.context.close();
  });

  test('recurring: cron creates due expenses and requires the secret', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    await a.page.goto('/expenses/new');
    await a.page.getByPlaceholder('e.g. Dinner, Netflix, Rent...').fill('Netflix');
    await a.page.locator('input[name="amount"]').fill('15');
    await a.page.getByLabel('Repeat this expense').check();
    await a.page.getByRole('button', { name: 'Add Expense' }).click();
    await expect(a.page.getByText('Expense added!')).toBeVisible();

    const template = await prisma.recurringTemplate.findFirstOrThrow({
      where: { userId: alice.id, description: 'Netflix' },
    });
    expect(template.interval).toBe('monthly');
    await prisma.recurringTemplate.update({
      where: { id: template.id },
      data: { nextRunAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) },
    });

    const denied = await a.page.request.get('/api/cron/recurring');
    expect(denied.status()).toBe(401);
    const ok = await a.page.request.get('/api/cron/recurring', {
      headers: { authorization: 'Bearer e2e-cron-secret' },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).created).toBeGreaterThanOrEqual(1);

    expect(await prisma.expense.count({ where: { recurringId: template.id } })).toBe(2);
    const after = await prisma.recurringTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(after.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    await a.context.close();
  });

  test('export: CSV/JSON honour the date range', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const all = await a.page.request.get('/api/export?type=json');
    expect((await all.json()).length).toBeGreaterThanOrEqual(2);

    const none = await a.page.request.get('/api/export?type=json&from=2001-01-01&to=2001-01-31');
    expect(await none.json()).toEqual([]);

    const bad = await a.page.request.get('/api/export?type=json&from=garbage');
    expect(bad.status()).toBe(400);

    await a.page.goto('/analytics');
    await a.page.getByTestId('export-from').fill('2001-01-01');
    await expect(a.page.getByTestId('export-csv')).toHaveAttribute('href', /from=2001-01-01/);
    await a.context.close();
  });

  test('Splitwise import: preview then import a CSV into a group', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const groupId = await createGroup(a.page, 'Imported trip', [bob.email]);
    const csv = [
      'Date,Description,Category,Cost,Currency,Anna,Ben',
      '2024-03-01,Hotel,Hotel,200.00,USD,100.00,-100.00',
      '2024-03-02,Taxi,Taxi,20.00,USD,-10.00,10.00',
      '2024-03-03,Settle all balances,Payment,30.00,USD,-30.00,30.00',
      ',Total balance, ,0.00, USD,60.00,-60.00',
    ].join('\n');

    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Import from Splitwise').click();
    await a.page.locator('input[type="file"][accept*="csv"]').setInputFiles({
      name: 'splitwise.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await a.page.getByRole('button', { name: 'Preview' }).click();
    await expect(a.page.getByText('2 expenses and 1 payments found')).toBeVisible();
    await a.page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(a.page.getByText('Import complete')).toBeVisible();

    expect(await prisma.expense.count({ where: { groupId } })).toBe(2);
    expect(await prisma.payment.count({ where: { groupId } })).toBe(1);

    // Unknown members are reported, not silently dropped
    const res = await api<{ error: string }>(a.page, 'post', '/api/import', {
      groupId,
      csv: csv.replace(/Ben/g, 'Stranger'),
    });
    expect(res.status).toBe(422);
    await a.context.close();
  });

  test('large import: 300 rows (3-member group, 2 people in the file) all save and can be shown', async ({
    browser,
  }) => {
    const third = await createUser('Third');
    const a = await sessionFor(browser, alice);
    const groupId = await createGroup(a.page, 'Big import', [bob.email, third.email]);

    // Splitwise-style export: blank first row, US dates, a payment row and the dated total row
    const rows = Array.from(
      { length: 300 },
      (_, i) =>
        `${(i % 12) + 1}/${(i % 27) + 1}/26,Item ${i},Groceries,${100 + i},INR,${(100 + i) / 2},${-(100 + i) / 2}`,
    );
    const csv = [
      ',,,,,,',
      'Date,Description,Category,Cost,Currency,Anna,Ben',
      ...rows,
      '3/10/26,Anna paid Ben,Payment,50,INR,50,-50',
      '11/11/26,Total balance, , ,INR,0,0',
    ].join('\n');

    await a.page.locator('[data-testid="group-menu"]:visible').click();
    await a.page.getByText('Import from Splitwise').click();
    await a.page.locator('input[type="file"][accept*="csv"]').setInputFiles({
      name: 'export.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await a.page.getByRole('button', { name: 'Preview' }).click();
    await expect(a.page.getByText('300 expenses and 1 payments found')).toBeVisible();

    const started = Date.now();
    await a.page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(a.page.getByText('Import complete')).toBeVisible({ timeout: 30_000 });
    expect(Date.now() - started).toBeLessThan(30_000); // used to time out and roll back

    // Everything was really saved, with the right dates (M/D/YY) and category
    expect(await prisma.expense.count({ where: { groupId } })).toBe(300);
    expect(await prisma.payment.count({ where: { groupId } })).toBe(1);
    const first = await prisma.expense.findFirstOrThrow({
      where: { groupId, description: 'Item 0' },
    });
    expect(first.date.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(first.category).toBe('groceries');

    // The group shows the count and lets you page through every expense
    await a.page.goto(`/groups/${groupId}`);
    await expect(a.page.getByRole('button', { name: /Expenses \(300\)/ })).toBeVisible();
    const cards = a.page.locator('a[href^="/expenses/"]:not([href^="/expenses/new"])');
    await expect(cards).toHaveCount(50);
    const more = a.page.getByTestId('load-more-expenses');
    for (let i = 0; i < 6 && (await more.count()) > 0; i++) {
      const before = await cards.count();
      await more.click();
      // the button disappears after the last page, so wait for the list to grow instead
      await expect.poll(() => cards.count()).toBeGreaterThan(before);
    }
    await expect(cards).toHaveCount(300);
    await expect(more).toHaveCount(0);
    await a.context.close();
  });

  test('push subscriptions can be saved and removed', async ({ browser }) => {
    const a = await sessionFor(browser, alice);
    const cfg = await api<{ enabled: boolean; publicKey: string }>(a.page, 'get', '/api/push');
    expect(cfg.body.enabled).toBe(true);
    expect(cfg.body.publicKey).toMatch(/^B/);

    const sub = {
      endpoint: 'https://push.example.test/send/abc123',
      keys: {
        p256dh:
          'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    };
    expect((await api(a.page, 'post', '/api/push', sub)).status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { userId: alice.id } })).toBe(1);
    expect((await api(a.page, 'post', '/api/push', { endpoint: 'bad' })).status).toBe(400);
    await api(a.page, 'delete', '/api/push', { endpoint: sub.endpoint });
    expect(await prisma.pushSubscription.count({ where: { userId: alice.id } })).toBe(0);

    // Signed-out API calls are bounced by the auth proxy (redirect to /login), never served
    const anon = await (
      await browser.newContext()
    ).request.post('/api/push', { data: sub, maxRedirects: 0 });
    expect([307, 308, 401]).toContain(anon.status());
    expect(await prisma.pushSubscription.count({ where: { endpoint: sub.endpoint } })).toBe(0);
    await a.context.close();
  });
});

test.describe('data consistency', () => {
  test('a friend is listed once even if both directions exist, and groups do not add duplicates', async ({
    browser,
  }) => {
    const x = await createUser('Dupe-X');
    const y = await createUser('Dupe-Y');
    // Legacy data: the same pair stored in both directions
    await prisma.friendship.createMany({
      data: [
        { userAId: x.id, userBId: y.id, status: 'accepted' },
        { userAId: y.id, userBId: x.id, status: 'accepted' },
      ],
    });

    const s = await sessionFor(browser, x);
    await s.page.goto('/friends');
    await expect(s.page.getByText(y.email)).toHaveCount(1);
    const list = await api<Array<{ friend: { id: string } }>>(s.page, 'get', '/api/friends');
    expect(list.body.filter((f) => f.friend.id === y.id)).toHaveLength(1);

    // Creating a group with them must not add a third row
    await createGroup(s.page, 'Dedup group', [y.email]);
    expect(
      await prisma.friendship.count({
        where: {
          OR: [
            { userAId: x.id, userBId: y.id },
            { userAId: y.id, userBId: x.id },
          ],
        },
      }),
    ).toBe(2);

    // The expense form lists them once (no duplicate-key crash)
    const errors: string[] = [];
    s.page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await s.page.goto('/expenses/new');
    await expect(s.page.getByText('Split with')).toBeVisible();
    await expect(s.page.getByText('Dupe-Y')).toHaveCount(1);
    expect(errors.filter((e) => /same key/i.test(e))).toEqual([]);

    // Removing the friend removes every row
    const friendRow = list.body[0] as unknown as { id: string };
    await api(s.page, 'delete', `/api/friends/${friendRow.id}`);
    expect(
      await prisma.friendship.count({
        where: {
          OR: [
            { userAId: x.id, userBId: y.id },
            { userAId: y.id, userBId: x.id },
          ],
        },
      }),
    ).toBe(0);
    await s.context.close();
  });

  test('foreign-currency amounts show their own symbol plus a conversion; analytics converts', async ({
    browser,
  }) => {
    const u = await createUser('Globe');
    await prisma.user.update({ where: { id: u.id }, data: { currency: 'INR' } });
    for (const [description, amount, currency] of [
      ['Lunch in NYC', 10, 'USD'],
      ['Chai', 830, 'INR'],
      ['Ramen', 1500, 'JPY'],
    ] as const) {
      await prisma.expense.create({
        data: {
          description,
          amount,
          currency,
          paidById: u.id,
          splits: { create: [{ userId: u.id, amount }] },
        },
      });
    }

    const s = await sessionFor(browser, u);
    await s.page.goto('/expenses');
    const usd = s.page
      .locator('div', { hasText: 'Lunch in NYC' })
      .filter({ hasText: '$10.00' })
      .last();
    await expect(usd).toContainText(/≈ ₹[\d,]+\.\d{2}/); // converted into the preferred currency
    const inr = s.page.locator('div', { hasText: 'Chai' }).filter({ hasText: '₹830.00' }).last();
    await expect(inr).not.toContainText('≈'); // same currency: no conversion shown
    await expect(s.page.getByText('¥1,500').first()).toBeVisible(); // yen: symbol, no decimals

    // Analytics adds everything up in INR instead of mixing currencies
    const analytics = await api<{ summary: { totalSpent: number; currency: string } }>(
      s.page,
      'get',
      '/api/analytics?months=3',
    );
    expect(analytics.body.summary.currency).toBe('INR');
    // 10 USD + 830 INR + 1500 JPY is far more than the 2,340 you'd get by adding raw numbers
    // (10 USD ≈ 800+ INR, 1500 JPY ≈ 700+ INR)
    expect(analytics.body.summary.totalSpent).toBeGreaterThan(2450);
    expect(analytics.body.summary.totalSpent).toBeLessThan(3500);
    await s.context.close();
  });
});

test.describe('settings', () => {
  test('language switch translates the navigation', async ({ browser }) => {
    const u = await createUser('Lingua');
    const s = await sessionFor(browser, u);
    await s.page.goto('/settings');
    await s.page.getByRole('button', { name: 'Preferences' }).click();
    await s.page.getByTestId('locale').selectOption('es');
    await s.page.getByRole('button', { name: 'Save Preferences' }).click();
    await expect(s.page.getByText('Profile updated!')).toBeVisible();
    await expect(s.page.getByRole('link', { name: 'Grupos' }).first()).toBeVisible();
    await expect(s.page.getByRole('link', { name: 'Amigos' }).first()).toBeVisible();

    // Persisted: a fresh login still shows Spanish
    const again = await s.context.browser()!.newContext();
    const p = await again.newPage();
    await login(p, u);
    await expect(p.getByRole('link', { name: 'Grupos' }).first()).toBeVisible();
    await again.close();
    await s.context.close();
  });

  test('payment handles show up as pay links for friends who owe', async ({ browser }) => {
    const owed = await createUser('Payee');
    const debtor = await createUser('Payer');
    await prisma.friendship.create({
      data: { userAId: owed.id, userBId: debtor.id, status: 'accepted' },
    });
    // Payee paid 40, Payer owes 20
    await prisma.expense.create({
      data: {
        description: 'Tickets',
        amount: 40,
        paidById: owed.id,
        splits: {
          create: [
            { userId: owed.id, amount: 20 },
            { userId: debtor.id, amount: 20 },
          ],
        },
      },
    });

    const p = await sessionFor(browser, owed);
    await p.page.goto('/settings');
    await p.page.getByPlaceholder('Venmo username').fill('payee-venmo');
    await p.page.getByPlaceholder('UPI ID').fill('payee@upi');
    await p.page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(p.page.getByText('Profile updated!')).toBeVisible();

    const d = await sessionFor(browser, debtor);
    await d.page.goto('/friends');
    const venmo = d.page.getByRole('link', { name: 'Venmo' });
    await expect(venmo).toHaveAttribute('href', /venmo\.com\/payee-venmo\?txn=pay&amount=20\.00/);
    await expect(d.page.getByRole('link', { name: 'UPI' })).toHaveAttribute(
      'href',
      /^upi:\/\/pay\?pa=payee%40upi/,
    );
    await expect(d.page.getByRole('link', { name: 'PayPal' })).toHaveCount(0);
    await p.context.close();
    await d.context.close();
  });

  test('friends page "Settle" records a payment and clears the overall balance', async ({
    browser,
  }) => {
    const owed = await createUser('Lender');
    const debtor = await createUser('Borrower');
    await prisma.friendship.create({
      data: { userAId: owed.id, userBId: debtor.id, status: 'accepted' },
    });
    await prisma.expense.create({
      data: {
        description: 'Concert',
        amount: 80,
        paidById: owed.id,
        splits: {
          create: [
            { userId: owed.id, amount: 40 },
            { userId: debtor.id, amount: 40 },
          ],
        },
      },
    });

    const d = await sessionFor(browser, debtor);
    await d.page.goto('/friends');
    await d.page.getByRole('link', { name: 'Settle' }).click();
    await expect(d.page.locator('input[name="amount"]')).toHaveValue('40.00');
    await d.page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(d.page.getByText('Payment recorded!')).toBeVisible();
    await expect(d.page).toHaveURL(/\/payments/);

    const bal = await api<{ net: number }>(d.page, 'get', '/api/balances');
    expect(bal.body.net).toBeCloseTo(0, 2);
    expect(await prisma.payment.count({ where: { payerId: debtor.id, receiverId: owed.id } })).toBe(
      1,
    );
    await d.context.close();
  });

  test('delete account: wrong password refused, then anonymised and signed out', async ({
    browser,
  }) => {
    const u = await createUser('Goner');
    const s = await sessionFor(browser, u);
    await s.page.goto('/settings');
    await s.page.getByRole('button', { name: 'Security' }).click();

    s.page.on('dialog', (d) => d.accept());
    await s.page.getByPlaceholder('Confirm your password').fill('wrong-password');
    await s.page.getByRole('button', { name: 'Delete account' }).click();
    await expect(s.page.getByText('Password is incorrect')).toBeVisible();

    await s.page.getByPlaceholder('Confirm your password').fill(PASSWORD);
    await s.page.getByRole('button', { name: 'Delete account' }).click();
    await expect(s.page).toHaveURL(/\/(login)?$/);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.name).toBe('Deleted user');
    expect(row.email).toContain('@deleted.invalid');

    // The old credentials no longer work
    const fresh = await s.context.browser()!.newContext();
    const p = await fresh.newPage();
    await p.goto('/login');
    await p.getByPlaceholder('you@example.com').fill(u.email);
    await p.getByPlaceholder('••••••••').fill(PASSWORD);
    await p.getByRole('button', { name: 'Sign in' }).click();
    await expect(p.getByText('No account found')).toBeVisible();
    await fresh.close();
    await s.context.close();
  });
});
