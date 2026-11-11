jest.mock('@/lib/push', () => ({ sendPush: jest.fn(), isPushConfigured: () => false }));
const mockPrisma = {
  groupMember: { count: jest.fn() },
  expense: { findMany: jest.fn() },
  payment: { findMany: jest.fn(), create: jest.fn() },
  activity: { create: jest.fn() },
  notification: { create: jest.fn() },
  group: { findUnique: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/payments/route';
import { pairOwed } from '@/lib/group-balance';

const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest('http://localhost/api/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

// Alice paid a 100 USD bill split 50/50, so Bob owes Alice 50
const aliceLent = {
  id: 'e1',
  paidById: 'alice',
  currency: 'USD',
  splits: [
    { userId: 'alice', amount: 50 },
    { userId: 'bob', amount: 50 },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuth.mockResolvedValue({ user: { id: 'bob', name: 'Bob' } });
  mockPrisma.expense.findMany.mockResolvedValue([aliceLent]);
  mockPrisma.payment.findMany.mockResolvedValue([]);
  mockPrisma.payment.create.mockImplementation(async ({ data }) => ({
    id: 'p1',
    ...data,
    payer: { id: data.payerId, name: data.payerId },
    receiver: { id: data.receiverId, name: data.receiverId },
  }));
});

describe('pairOwed', () => {
  it('is what the payer owes the receiver, never negative', () => {
    const net = { alice: { bob: 50 }, bob: { alice: -50 } };
    expect(pairOwed(net, 'bob', 'alice')).toBe(50);
    expect(pairOwed(net, 'alice', 'bob')).toBe(0);
    expect(pairOwed({}, 'x', 'y')).toBe(0);
  });
});

describe('POST /api/payments', () => {
  it('accepts exactly what is owed', async () => {
    const res = await post({ receiverId: 'alice', amount: 50, currency: 'USD' });
    expect(res.status).toBe(201);
    expect(mockPrisma.payment.create.mock.calls[0][0].data).toMatchObject({
      payerId: 'bob',
      receiverId: 'alice',
      amount: 50,
    });
  });

  it('rejects paying more than is owed', async () => {
    const res = await post({ receiverId: 'alice', amount: 80, currency: 'USD' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/outstanding is \$50\.00/);
    expect(mockPrisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects a payment when nothing is owed', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);
    const res = await post({ receiverId: 'alice', amount: 5, currency: 'USD' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nothing to settle/);
  });

  it('takes earlier payments into account', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      { payerId: 'bob', receiverId: 'alice', amount: 30, currency: 'USD' },
    ]);
    expect((await post({ receiverId: 'alice', amount: 30, currency: 'USD' })).status).toBe(400);
    expect((await post({ receiverId: 'alice', amount: 20, currency: 'USD' })).status).toBe(201);
  });

  it('converts currencies when checking the amount', async () => {
    // 50 USD owed ≈ 4155 INR at the fallback rate (83.1) — 5000 INR is too much, 4000 is fine
    expect((await post({ receiverId: 'alice', amount: 5000, currency: 'INR' })).status).toBe(400);
    expect((await post({ receiverId: 'alice', amount: 4000, currency: 'INR' })).status).toBe(201);
  });

  it('lets the receiver record that the other person paid', async () => {
    mockGetAuth.mockResolvedValue({ user: { id: 'alice', name: 'Alice' } });
    const res = await post({ payerId: 'bob', receiverId: 'alice', amount: 50, currency: 'USD' });
    expect(res.status).toBe(201);
    expect(mockPrisma.payment.create.mock.calls[0][0].data.payerId).toBe('bob');
    expect(mockPrisma.notification.create.mock.calls[0][0].data.userId).toBe('bob');
  });

  it('forbids recording payments between two other people', async () => {
    mockGetAuth.mockResolvedValue({ user: { id: 'mallory', name: 'Mallory' } });
    const res = await post({ payerId: 'bob', receiverId: 'alice', amount: 50, currency: 'USD' });
    expect(res.status).toBe(403);
  });

  it('refuses to pay yourself and requires both people in the group', async () => {
    expect((await post({ receiverId: 'bob', amount: 5, currency: 'USD' })).status).toBe(400);
    mockPrisma.groupMember.count.mockResolvedValue(1);
    expect(
      (await post({ receiverId: 'alice', amount: 5, currency: 'USD', groupId: 'g1' })).status,
    ).toBe(400);
  });
});
