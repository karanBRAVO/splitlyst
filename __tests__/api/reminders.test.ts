jest.mock('@/lib/push', () => ({ sendPush: jest.fn(), isPushConfigured: () => false }));
const mockPrisma = {
  friendship: { findFirst: jest.fn() },
  groupMember: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
  notification: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/reminders/route';
import { resetRateLimits } from '@/lib/rate-limit';

const call = (userId: unknown) =>
  POST(
    new NextRequest('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  resetRateLimits();
  delete process.env.RESEND_API_KEY;
  mockGetAuth.mockResolvedValue({ user: { id: 'me', name: 'Me' } });
  mockPrisma.friendship.findFirst.mockResolvedValue({ id: 'f' });
  mockPrisma.groupMember.findFirst.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', name: 'U2', email: 'u2@x.com' });
});

describe('POST /api/reminders', () => {
  it('sends an in-app notification', async () => {
    const res = await call('u2');
    expect(res.status).toBe(200);
    expect(mockPrisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u2',
      type: 'payment_reminder',
    });
  });

  it('rate limits repeat reminders to the same person', async () => {
    expect((await call('u2')).status).toBe(200);
    expect((await call('u2')).status).toBe(429);
  });

  it('refuses strangers, self and bad input', async () => {
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    expect((await call('stranger')).status).toBe(403);
    expect((await call('me')).status).toBe(400);
    expect((await call(undefined)).status).toBe(400);
  });

  it('requires auth', async () => {
    mockGetAuth.mockResolvedValue(null);
    expect((await call('u2')).status).toBe(401);
  });
});
