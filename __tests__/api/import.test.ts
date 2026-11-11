jest.mock('@/lib/push', () => ({ sendPush: jest.fn(), isPushConfigured: () => false }));
const mockPrisma = {
  group: { findUnique: jest.fn() },
  expense: { createMany: jest.fn((args) => ({ op: 'expense', args })) },
  expenseSplit: { createMany: jest.fn((args) => ({ op: 'split', args })) },
  payment: { createMany: jest.fn((args) => ({ op: 'payment', args })) },
  activity: { create: jest.fn((args) => ({ op: 'activity', args })) },
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/import/route';

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('http://localhost/api/import', { method: 'POST', body: JSON.stringify(body) }),
  );

const group = {
  id: 'g1',
  isArchived: false,
  members: [
    { userId: 'u1', user: { id: 'u1', name: 'Karan 57 Yadav' } },
    { userId: 'u2', user: { id: 'u2', name: 'mogilon504' } },
    { userId: 'u3', user: { id: 'u3', name: 'Third Member' } }, // not in the CSV: that's fine
  ],
};

const csv = (rows: number) =>
  [
    ',,,,,,',
    'Date,Description,Category,Cost,Currency,Karan 57 Yadav,mogilon504',
    ...Array.from({ length: rows }, (_, i) => `2/10/26,Item ${i},Groceries,100,INR,50,-50`),
    '3/10/26,Karan Y. paid Vikas,Payment,40,INR,40,-40',
    '11/11/26,Total balance, , ,INR,0,0',
  ].join('\n');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuth.mockResolvedValue({ user: { id: 'u1', name: 'Karan 57 Yadav' } });
  mockPrisma.group.findUnique.mockResolvedValue(group);
  mockPrisma.$transaction.mockResolvedValue([]);
});

describe('POST /api/import', () => {
  it('works with more people in the group than in the CSV', async () => {
    const res = await post({ groupId: 'g1', csv: csv(3), dryRun: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ expenses: 3, payments: 1, skipped: [] });
  });

  it('imports hundreds of rows with a constant number of statements (no per-row inserts)', async () => {
    const res = await post({ groupId: 'g1', csv: csv(300) });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ imported: true, expenses: 300, payments: 1 });

    // one atomic batch of four statements, however many rows
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const batch = mockPrisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(batch)).toBe(true);
    expect(batch).toHaveLength(4);
    expect(mockPrisma.expense.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.expense.createMany.mock.calls[0][0].data).toHaveLength(300);
    expect(mockPrisma.payment.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it('links every split to its expense id and resolves people by name', async () => {
    await post({ groupId: 'g1', csv: csv(2) });
    const expenses = mockPrisma.expense.createMany.mock.calls[0][0].data;
    const splits = mockPrisma.expenseSplit.createMany.mock.calls[0][0].data;
    const ids = new Set(expenses.map((e: { id: string }) => e.id));
    expect(ids.size).toBe(2);
    expect(splits.every((s: { expenseId: string }) => ids.has(s.expenseId))).toBe(true);
    expect(expenses[0]).toMatchObject({
      paidById: 'u1',
      currency: 'INR',
      groupId: 'g1',
      category: 'groceries',
    });
    expect(expenses[0].date.toISOString().slice(0, 10)).toBe('2026-02-10');
    expect(splits.map((s: { userId: string }) => s.userId).sort()).toEqual([
      'u1',
      'u1',
      'u2',
      'u2',
    ]);
    const pay = mockPrisma.payment.createMany.mock.calls[0][0].data[0];
    expect(pay).toMatchObject({ payerId: 'u1', receiverId: 'u2', amount: 40, groupId: 'g1' });
  });

  it('reports a failed save as JSON and says nothing was saved', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPrisma.$transaction.mockRejectedValue(new Error('db down'));
    const res = await post({ groupId: 'g1', csv: csv(2) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/nothing was saved/i);
  });

  it('refuses files with too many rows', async () => {
    const res = await post({ groupId: 'g1', csv: csv(5001) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/limit/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('reports people it cannot match instead of dropping them', async () => {
    const res = await post({ groupId: 'g1', csv: csv(1).replace(/mogilon504/g, 'Stranger') });
    expect(res.status).toBe(422);
    expect((await res.json()).unmatched).toEqual(['Stranger']);
  });

  it('requires membership and a signed-in user', async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ ...group, members: [group.members[1]] });
    expect((await post({ groupId: 'g1', csv: csv(1) })).status).toBe(404);
    mockGetAuth.mockResolvedValue(null);
    expect((await post({ groupId: 'g1', csv: csv(1) })).status).toBe(401);
  });
});
