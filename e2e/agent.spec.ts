import { expect, test, type Page } from '@playwright/test';
import { api, createUser, prisma, sessionFor, type TestUser } from './helpers';

const GATEWAY = 'http://localhost:3199';

async function befriend(a: TestUser, b: TestUser) {
  await prisma.friendship.create({ data: { userAId: a.id, userBId: b.id, status: 'accepted' } });
}

async function propose(page: Page, text: string) {
  await page.goto('/agent');
  await page.getByTestId('agent-text').fill(text);
  await page.getByTestId('agent-propose').click();
}

test.describe.serial('AI agent (fake Otari gateway)', () => {
  let me: TestUser;
  let priya: TestUser;

  test.beforeAll(async () => {
    me = await createUser('Agentuser');
    priya = await createUser('Priya');
    await befriend(me, priya);
    await fetch(`${GATEWAY}/__reset`, { method: 'POST' });
  });

  test('shows the AI Agent link and an unused allowance', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await expect(s.page.getByRole('link', { name: 'AI Agent' })).toBeVisible();
    await s.page.goto('/agent');
    await expect(s.page.getByRole('heading', { name: 'AI Agent' }).first()).toBeVisible();
    await expect(s.page.getByTestId('allowance-text')).toContainText('$0.0000 of $0.10');
    await s.context.close();
  });

  test('plain English becomes a proposal; nothing is saved until you confirm', async ({
    browser,
  }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Dinner 60 with Priya, I paid');

    const card = s.page.getByTestId('agent-proposal');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Dinner');
    await expect(card).toContainText('₹60.00');
    await expect(card).toContainText('Paid by Agentuser');
    await expect(card).toContainText('Priya'); // both people appear with an equal share
    await expect(card.getByText('₹30.00')).toHaveCount(2);

    // The inspector proves which Otari model answered and what it cost
    await expect(s.page.getByTestId('inspector-model-reader')).toContainText(
      'Qwen/Qwen3-30B-A3B-Instruct-2507',
    );
    await expect(s.page.getByTestId('inspector-usage-reader')).toContainText('85 tokens');
    await expect(s.page.getByTestId('inspector-fallback-reader')).toHaveCount(0);

    // ...and it was sent to Otari under this user's own id (that is what per-user budgets key on)
    const reader = await (await fetch(`${GATEWAY}/__last?kind=reader`)).json();
    expect(reader.user).toBe(me.id);
    expect(reader.messages[1].content).toBe('<expense>Dinner 60 with Priya, I paid</expense>');

    // The second model (the planner) is called through the routing policy, with the code tool,
    // under the same user id
    await expect(s.page.getByTestId('agent-verify')).toHaveAttribute('data-status', 'verified');
    const verifier = await (await fetch(`${GATEWAY}/__last?kind=verifier`)).json();
    expect(verifier.model).toBe('splitlyst-agent');
    expect(verifier.tools).toEqual([{ type: 'otari_code_execution' }]);
    expect(verifier.user).toBe(me.id);

    // Still nothing in the database
    expect(await prisma.expense.count({ where: { paidById: me.id, description: 'Dinner' } })).toBe(
      0,
    );

    await s.page.getByTestId('agent-confirm').click();
    await expect(s.page.getByTestId('agent-saved')).toBeVisible();

    const saved = await prisma.expense.findFirstOrThrow({
      where: { paidById: me.id, description: 'Dinner' },
      include: { splits: true },
    });
    expect(saved.amount).toBe(60);
    expect(saved.currency).toBe('INR');
    expect(saved.category).toBe('food');
    expect(saved.splits.map((x) => [x.userId, x.amount]).sort()).toEqual(
      [
        [me.id, 30],
        [priya.id, 30],
      ].sort(),
    );
    await s.context.close();
  });

  test('discard saves nothing', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Snacks 40 with Priya, I paid');
    await expect(s.page.getByTestId('agent-proposal')).toBeVisible();
    await s.page.getByTestId('agent-discard').click();
    await expect(s.page.getByTestId('agent-proposal')).toHaveCount(0);
    expect(await prisma.expense.count({ where: { paidById: me.id, description: 'Snacks' } })).toBe(
      0,
    );
    await s.context.close();
  });

  test('people it cannot find are flagged, never invented', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Lunch 90 with Mallory, I paid');
    await expect(s.page.getByTestId('agent-unmatched')).toContainText('Mallory');
    await expect(s.page.getByTestId('agent-proposal')).not.toContainText('Mallory Strange');
    await s.context.close();
  });

  test('a backup model answering is visible in the inspector', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea 20 [fallback]');
    await expect(s.page.getByTestId('inspector-fallback-reader')).toContainText(
      'backup model used',
    );
    await expect(s.page.getByTestId('inspector-model-reader')).toContainText('zai-org/GLM-4.7');
    await s.context.close();
  });

  test('using up the daily allowance shows a friendly message, not a crash', async ({
    browser,
  }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea 20 [budget]');
    const err = s.page.getByTestId('agent-error');
    await expect(err).toContainText("You've used today's AI allowance");
    await expect(err).toHaveAttribute('data-kind', 'budget_exceeded');
    await expect(err).not.toContainText('End user'); // no raw gateway text
    await s.context.close();
  });

  test('gateway outages and unusable answers are explained plainly', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea 20 [down]');
    await expect(s.page.getByTestId('agent-error')).toContainText('unavailable');
    await expect(s.page.getByTestId('agent-error')).toHaveAttribute('data-kind', 'unavailable');

    await propose(s.page, 'Tea 20 [junk]');
    await expect(s.page.getByTestId('agent-error')).toContainText("couldn't understand");
    await expect(s.page.getByTestId('inspector-model-reader')).toBeVisible(); // still shows what ran
    await s.context.close();
  });

  test('the allowance meter grows as the agent is used', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    const before = await api<{ allowance: { spentUsd: number } }>(
      s.page,
      'get',
      '/api/agent/status',
    );
    await propose(s.page, 'Coffee 15 with Priya, I paid');
    await expect(s.page.getByTestId('agent-proposal')).toBeVisible();
    const after = await api<{ allowance: { spentUsd: number; remainingUsd: number } }>(
      s.page,
      'get',
      '/api/agent/status',
    );
    expect(after.body.allowance.spentUsd).toBeGreaterThan(before.body.allowance.spentUsd);
    await s.page.goto('/agent');
    await expect(s.page.getByTestId('allowance-text')).not.toContainText('$0.0000 of');
    await s.context.close();
  });

  test('a second model re-checks the maths with real code and the card shows it', async ({
    browser,
  }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Dinner 100 with Priya, I paid');
    // the proposal appears right away; the code check follows
    await expect(s.page.getByTestId('agent-proposal')).toBeVisible();
    const badge = s.page.getByTestId('agent-verify');
    await expect(badge).toHaveAttribute('data-status', 'verified');
    await expect(badge).toContainText('ran code');
    // the planner is a different, larger model and Otari reports the code tool it ran
    await expect(s.page.getByTestId('inspector-model-planner')).toContainText('Qwen3-235B');
    await expect(s.page.getByTestId('otari-inspector')).toContainText('code_execution');
    await s.context.close();
  });

  test('if the code check disagrees, the user is warned and the server maths is what gets saved', async ({
    browser,
  }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea [wrong] 60 with Priya, I paid');
    const badge = s.page.getByTestId('agent-verify');
    await expect(badge).toHaveAttribute('data-status', 'mismatch');
    await expect(badge).toContainText('server maths');

    await s.page.getByTestId('agent-confirm').click();
    await expect(s.page.getByTestId('agent-saved')).toBeVisible();
    const saved = await prisma.expense.findFirstOrThrow({
      where: { paidById: me.id, description: 'Tea [wrong]' },
      include: { splits: true },
    });
    expect(saved.splits.map((x) => x.amount).sort()).toEqual([30, 30]); // exact, not the model's +1
    await s.context.close();
  });

  test('an answer that never ran code is not called verified', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea [nocode] 60 with Priya, I paid');
    await expect(s.page.getByTestId('agent-verify')).toHaveAttribute('data-status', 'unverified');
    await s.context.close();
  });

  test('a backup model serving the code check is visible', async ({ browser }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Tea [fallback] 60 with Priya, I paid');
    await expect(s.page.getByTestId('inspector-fallback-planner')).toContainText(
      'backup model used',
    );
    await expect(s.page.getByTestId('inspector-model-planner')).toContainText('GLM-4.7');
    await s.context.close();
  });

  test('the check never blocks saving: confirming works while it is still running', async ({
    browser,
  }) => {
    const s = await sessionFor(browser, me);
    await propose(s.page, 'Chai 40 with Priya, I paid');
    await s.page.getByTestId('agent-confirm').click(); // do not wait for the badge
    await expect(s.page.getByTestId('agent-saved')).toBeVisible();
    expect(await prisma.expense.count({ where: { paidById: me.id, description: 'Chai' } })).toBe(1);
    await s.context.close();
  });

  test('the verify endpoint validates input and needs sign-in', async ({ browser, request }) => {
    const s = await sessionFor(browser, me);
    const bad = await api(s.page, 'post', '/api/agent/verify', {
      amount: -5,
      splitType: 'equal',
      people: [],
    });
    expect(bad.status).toBe(400);
    const ok = await api<{ status: string; codeRan: boolean }>(
      s.page,
      'post',
      '/api/agent/verify',
      {
        description: 'x',
        amount: 100,
        splitType: 'equal',
        people: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      },
    );
    expect(ok.body).toMatchObject({ status: 'verified', codeRan: true });
    const anon = await request.post('/api/agent/verify', { data: {}, maxRedirects: 0 });
    expect([307, 308, 401]).toContain(anon.status());
    await s.context.close();
  });

  test('the agent only works inside groups you belong to', async ({ browser }) => {
    const stranger = await createUser('Stranger');
    const group = await prisma.group.create({
      data: { name: 'Private', members: { create: [{ userId: stranger.id, role: 'admin' }] } },
    });
    const s = await sessionFor(browser, me);
    const res = await api(s.page, 'post', '/api/agent/propose', {
      text: 'Dinner 60',
      groupId: group.id,
    });
    expect(res.status).toBe(404);
    await s.context.close();
  });

  test('requires sign-in', async ({ request }) => {
    const res = await request.post('/api/agent/propose', {
      data: { text: 'Dinner 60' },
      maxRedirects: 0,
    });
    expect([307, 308, 401]).toContain(res.status());
  });
});
