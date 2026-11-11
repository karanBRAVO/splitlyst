const mockPrisma = {
  groupMember: { findMany: jest.fn() },
  user: { findUnique: jest.fn() },
  friendship: { findMany: jest.fn() },
  expense: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST as propose } from '@/app/api/agent/propose/route';
import { GET as status } from '@/app/api/agent/status/route';
import { resetRateLimits } from '@/lib/rate-limit';

const ENV = { ...process.env };
const gateway = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const reply = (draft: unknown) => ({
  choices: [{ message: { content: typeof draft === 'string' ? draft : JSON.stringify(draft) } }],
  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70, cost_usd: '0.00002' },
});

const post = (body: unknown) =>
  propose(
    new NextRequest('http://localhost/api/agent/propose', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

const me = { id: 'me', name: 'Karan Yadav' };
const priya = { id: 'p1', name: 'Priya Sharma' };
const amit = { id: 'p2', name: 'Amit Patel' };

beforeEach(() => {
  jest.clearAllMocks();
  resetRateLimits();
  process.env.OTARI_API_KEY = 'otk_test';
  process.env.OTARI_BASE_URL = 'https://gateway.test/api/v1';
  mockGetAuth.mockResolvedValue({ user: { id: 'me', name: 'Karan Yadav', currency: 'INR' } });
  mockPrisma.user.findUnique.mockResolvedValue(me);
  mockPrisma.friendship.findMany.mockResolvedValue([
    { userAId: 'me', userBId: 'p1', userA: me, userB: priya },
    { userAId: 'p2', userBId: 'me', userA: amit, userB: me },
  ]);
});
afterEach(() => {
  process.env = { ...ENV };
  jest.restoreAllMocks();
});

describe('POST /api/agent/propose', () => {
  it('turns plain English into a proposal with server-computed shares, and saves nothing', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      gateway(
        200,
        reply({
          description: 'Dinner',
          amount: 3200,
          currency: 'INR',
          category: 'food',
          paidBy: 'me',
          participants: ['Priya', 'Amit'],
        }),
        { 'Otari-Model': 'Qwen/Qwen3-30B-A3B-Instruct-2507', 'Otari-Fallback': 'false' },
      ),
    );
    const res = await post({ text: 'Dinner 3200 with Priya and Amit, I paid' });
    expect(res.status).toBe(200);
    const { draft, inspector } = await res.json();

    expect(draft).toMatchObject({
      description: 'Dinner',
      amount: 3200,
      currency: 'INR',
      paidById: 'me',
      paidByName: 'Karan Yadav',
      splitType: 'equal',
    });
    const total = draft.shares.reduce((s: number, x: { amount: number }) => s + x.amount, 0);
    expect(Math.round(total * 100) / 100).toBe(3200); // the server's arithmetic always adds up
    expect(draft.shares.map((s: { name: string }) => s.name).sort()).toEqual([
      'Amit Patel',
      'Karan Yadav',
      'Priya Sharma',
    ]);
    expect(inspector).toMatchObject({
      role: 'reader',
      model: 'Qwen/Qwen3-30B-A3B-Instruct-2507',
      fallback: false,
    });
    expect(mockPrisma.expense.create).not.toHaveBeenCalled(); // proposal only — the user confirms separately

    // the per-user budget key and the "treat as data" prompt both went out
    const sent = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.user).toBe('me');
    expect(sent.messages[1].content).toBe(
      '<expense>Dinner 3200 with Priya and Amit, I paid</expense>',
    );
  });

  it('only offers the group members to the model, and rejects non-members', async () => {
    mockPrisma.groupMember.findMany.mockResolvedValue([
      { userId: 'me', user: me },
      { userId: 'p2', user: amit },
    ]);
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        gateway(
          200,
          reply({ description: 'Cab', amount: 400, paidBy: 'Amit', participants: ['me'] }),
        ),
      );
    const res = await post({ text: 'Cab 400 Amit paid', groupId: 'g1' });
    expect(res.status).toBe(200);
    expect((await res.json()).draft.paidByName).toBe('Amit Patel');
    const prompt = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string).messages[0]
      .content;
    expect(prompt).toContain('Amit Patel');
    expect(prompt).not.toContain('Priya Sharma'); // a friend outside the group is not offered

    mockPrisma.groupMember.findMany.mockResolvedValue([{ userId: 'p2', user: amit }]); // I'm not in it
    expect((await post({ text: 'Cab 400', groupId: 'g2' })).status).toBe(404);
  });

  it('never trusts the model with people it cannot match, and says so', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        gateway(
          200,
          reply({ description: 'Lunch', amount: 900, participants: ['Priya', 'Mallory'] }),
        ),
      );
    const { draft } = await (await post({ text: 'Lunch 900 with Priya and Mallory' })).json();
    expect(draft.unmatched).toEqual(['Mallory']);
    expect(draft.participantIds.sort()).toEqual(['me', 'p1']);
  });

  it('reports a reply it cannot use as a friendly 422 (still showing the inspector)', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(gateway(200, reply('I am sorry, I cannot help.')));
    const res = await post({ text: 'blah blah' });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.kind).toBe('unparsed');
    expect(body.inspector.role).toBe('reader');
    expect(mockPrisma.expense.create).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the per-user budget is used up', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      gateway(403, {
        detail: "End user 'me' is over budget",
        code: 'budget_exceeded',
        end_user: 'me',
      }),
    );
    const res = await post({ text: 'Dinner 100' });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.kind).toBe('budget_exceeded');
    expect(body.error).toMatch(/allowance/i);
    expect(JSON.stringify(body)).not.toMatch(/End user 'me'/); // no raw gateway text leaks
  });

  it.each([
    [402, 'insufficient_funds', 402],
    [403, 'guardrail_violation', 403],
    [503, 'unavailable', 503],
  ])('maps gateway HTTP %s to %s', async (code, kind, expected) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      gateway(code, {
        detail: 'x',
        ...(kind === 'guardrail_violation' ? { code: 'guardrail_violation' } : {}),
      }),
    );
    const res = await post({ text: 'Dinner 100' });
    expect(res.status).toBe(expected);
    expect((await res.json()).kind).toBe(kind);
  });

  it('validates input, requires login and configuration, and rate limits', async () => {
    expect((await post({ text: 'hi' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ text: 'x'.repeat(2001) })).status).toBe(400);

    mockGetAuth.mockResolvedValue(null);
    expect((await post({ text: 'Dinner 100' })).status).toBe(401);

    mockGetAuth.mockResolvedValue({ user: { id: 'me', name: 'K', currency: 'INR' } });
    delete process.env.OTARI_API_KEY;
    const off = await post({ text: 'Dinner 100' });
    expect(off.status).toBe(503);
    expect((await off.json()).kind).toBe('not_configured');
  });

  it('rate limits bursts per user', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => gateway(200, reply({ description: 'Tea', amount: 20 })));
    let blocked = 0;
    for (let i = 0; i < 24; i++) if ((await post({ text: 'Tea 20' })).status === 429) blocked++;
    expect(blocked).toBeGreaterThan(0);
  });
});

describe('GET /api/agent/status', () => {
  it('is disabled without a key', async () => {
    delete process.env.OTARI_API_KEY;
    expect(await (await status()).json()).toEqual({ enabled: false });
  });

  it('reports the remaining daily allowance from Otari', async () => {
    process.env.OTARI_DAILY_BUDGET_USD = '0.10';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      gateway(200, [
        {
          external_id: 'me',
          spend: 0.0314,
          blocked: false,
          next_budget_reset_at: '2026-11-12T00:00:00+00:00',
        },
      ]),
    );
    const body = await (await status()).json();
    expect(body.enabled).toBe(true);
    expect(body.allowance.limitUsd).toBe(0.1);
    expect(body.allowance.spentUsd).toBeCloseTo(0.0314, 4);
    expect(body.allowance.remainingUsd).toBeCloseTo(0.0686, 4);
    expect(body.allowance.resetsAt).toBe('2026-11-12T00:00:00+00:00');
  });

  it('treats a brand-new user as having spent nothing, and never goes negative', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(gateway(200, []));
    expect((await (await status()).json()).allowance).toMatchObject({
      spentUsd: 0,
      remainingUsd: 0.1,
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(gateway(200, [{ external_id: 'me', spend: 5 }]));
    expect((await (await status()).json()).allowance.remainingUsd).toBe(0);
  });

  it('requires login', async () => {
    mockGetAuth.mockResolvedValue(null);
    expect((await status()).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------
import { POST as verify } from '@/app/api/agent/verify/route';

const postVerify = (body: unknown) =>
  verify(
    new NextRequest('http://localhost/api/agent/verify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

const split3 = {
  description: 'Dinner',
  amount: 100,
  splitType: 'equal',
  people: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
};
const planner = (shares: Array<{ person: number; amount: number }>, tools = true) =>
  gateway(
    200,
    {
      choices: [
        {
          message: {
            content: JSON.stringify({ total: shares.reduce((a, s) => a + s.amount, 0), shares }),
          },
        },
      ],
      usage: { total_tokens: 700, cost_usd: '0.0101' },
      ...(tools ? { otari_tool_calls: [{ type: 'code_execution', status: 'completed' }] } : {}),
    },
    { 'Otari-Model': 'Qwen/Qwen3-235B-A22B-Instruct-2507', 'Otari-Fallback': 'false' },
  );
const right = [
  { person: 1, amount: 33.34 },
  { person: 2, amount: 33.33 },
  { person: 3, amount: 33.33 },
];

describe('POST /api/agent/verify', () => {
  it('is verified when the code-computed split matches and Otari really ran code', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(planner(right));
    const res = await postVerify(split3);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'verified', codeRan: true, mismatches: [] });
    expect(body.inspector).toMatchObject({
      role: 'planner',
      model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    });

    const sent = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.model).toBe('splitlyst-agent'); // the routing policy with the automatic backup
    expect(sent.tools).toEqual([{ type: 'otari_code_execution' }]);
    expect(sent.user).toBe('me'); // billed to this user's own budget
  });

  it('flags a disagreement and the server numbers stay authoritative', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(planner([{ person: 1, amount: 33.36 }, right[1], right[2]]));
    const body = await (await postVerify(split3)).json();
    expect(body.status).toBe('mismatch');
    expect(body.mismatches[0]).toMatchObject({ person: 1, expected: 33.34, actual: 33.36 });
    expect(body.expected).toEqual(right); // what the app would save
  });

  it('is only "unverified" when the model answered correctly but never ran code', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(planner(right, false));
    const body = await (await postVerify(split3)).json();
    expect(body).toMatchObject({ status: 'unverified', codeRan: false });
  });

  it('is "unverified" when the reply is not usable JSON', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        gateway(200, { choices: [{ message: { content: 'I think it is about a third each.' } }] }),
      );
    expect((await (await postVerify(split3)).json()).status).toBe('unverified');
  });

  it('never fails the request when Otari does: budget, outage and guardrails become "unavailable"', async () => {
    for (const [status, payload, reason] of [
      [403, { code: 'budget_exceeded', detail: 'x' }, 'budget_exceeded'],
      [503, { detail: 'down' }, 'unavailable'],
      [403, { code: 'guardrail_violation', detail: 'x' }, 'guardrail_violation'],
    ] as const) {
      jest.spyOn(global, 'fetch').mockResolvedValue(gateway(status, payload));
      const res = await postVerify(split3);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: 'unavailable', reason });
    }
  });

  it('validates input and requires login, configuration and a sane request rate', async () => {
    expect(
      (await postVerify({ amount: -5, splitType: 'equal', people: [{ name: 'A' }] })).status,
    ).toBe(400);
    expect((await postVerify({})).status).toBe(400);

    mockGetAuth.mockResolvedValue(null);
    expect((await postVerify(split3)).status).toBe(401);

    mockGetAuth.mockResolvedValue({ user: { id: 'me', name: 'K', currency: 'INR' } });
    delete process.env.OTARI_API_KEY;
    expect((await postVerify(split3)).status).toBe(503);

    process.env.OTARI_API_KEY = 'otk_test';
    jest.spyOn(global, 'fetch').mockImplementation(async () => planner(right));
    let limited = 0;
    for (let i = 0; i < 24; i++) if ((await postVerify(split3)).status === 429) limited++;
    expect(limited).toBeGreaterThan(0);
  });
});
