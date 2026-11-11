const mockPrisma = {
  recurringTemplate: { findMany: jest.fn(), update: jest.fn() },
  expense: { create: jest.fn() },
  activity: { create: jest.fn() },
  notification: { createMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/recurring/route';

const req = (auth?: string) =>
  new NextRequest('http://localhost/api/cron/recurring', {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'secret';
  mockPrisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) =>
    Promise.all(ops),
  );
  mockPrisma.expense.create.mockResolvedValue({ id: 'e1' });
});

describe('GET /api/cron/recurring', () => {
  it('rejects requests without the secret', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    expect(mockPrisma.recurringTemplate.findMany).not.toHaveBeenCalled();
  });

  it('rejects everything when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req('Bearer undefined'))).status).toBe(401);
  });

  it('creates an expense for a due template and advances nextRunAt', async () => {
    mockPrisma.recurringTemplate.findMany.mockResolvedValue([
      {
        id: 't1',
        userId: 'u1',
        description: 'Rent',
        amount: 100,
        currency: 'USD',
        category: 'rent',
        splitType: 'equal',
        interval: 'monthly',
        nextRunAt: new Date('2020-01-01T00:00:00Z'),
        groupId: 'g1',
        data: { participants: ['u1', 'u2'], paidById: 'u1' },
      },
    ]);

    const res = await GET(req('Bearer secret'));
    expect(await res.json()).toEqual({ due: 1, created: 1, failed: [] });

    const created = mockPrisma.expense.create.mock.calls[0][0].data;
    expect(created.paidById).toBe('u1');
    expect(created.recurringId).toBe('t1');
    expect(created.splits.create).toEqual([
      expect.objectContaining({ userId: 'u1', amount: 50 }),
      expect.objectContaining({ userId: 'u2', amount: 50 }),
    ]);

    const nextRunAt: Date = mockPrisma.recurringTemplate.update.mock.calls[0][0].data.nextRunAt;
    expect(nextRunAt.getTime()).toBeGreaterThan(Date.now()); // skipped missed months
    expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('reports failures without aborting the batch', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockPrisma.recurringTemplate.findMany.mockResolvedValue([
      {
        id: 'bad',
        userId: 'u',
        description: 'x',
        amount: 1,
        currency: 'USD',
        category: 'general',
        splitType: 'equal',
        interval: 'daily',
        nextRunAt: new Date(0),
        groupId: null,
        data: {},
      },
    ]);
    mockPrisma.$transaction.mockRejectedValue(new Error('db down'));
    const body = await (await GET(req('Bearer secret'))).json();
    expect(body).toEqual({ due: 1, created: 0, failed: ['bad'] });
  });
});
