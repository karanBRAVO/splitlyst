jest.mock('@/lib/push', () => ({ sendPush: jest.fn(), isPushConfigured: () => false }));
const mockPrisma = {
  user: { findUnique: jest.fn() },
  friendship: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  notification: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/friends/route';
import { PATCH } from '@/app/api/friends/[id]/route';

const session = { user: { id: 'me', name: 'Me' } };
const post = (email: string) =>
  new NextRequest('http://localhost/api/friends', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuth.mockResolvedValue(session);
});

describe('POST /api/friends', () => {
  it('requires auth', async () => {
    mockGetAuth.mockResolvedValue(null);
    expect((await POST(post('a@b.c'))).status).toBe(401);
  });

  it('creates a pending request and notifies the target', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'them' });
    mockPrisma.friendship.findFirst.mockResolvedValue(null);
    mockPrisma.friendship.create.mockResolvedValue({ id: 'f1' });

    const res = await POST(post('them@x.com'));
    expect(res.status).toBe(201);
    expect(mockPrisma.friendship.create.mock.calls[0][0].data).toMatchObject({
      userAId: 'me',
      userBId: 'them',
      status: 'pending',
    });
    expect(mockPrisma.notification.create.mock.calls[0][0].data.type).toBe('friend_request');
  });

  it('accepts when the other person already asked', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'them' });
    mockPrisma.friendship.findFirst.mockResolvedValue({
      id: 'f9',
      status: 'pending',
      userAId: 'them',
    });
    mockPrisma.friendship.update.mockResolvedValue({ id: 'f9', status: 'accepted' });
    const res = await POST(post('them@x.com'));
    expect(res.status).toBe(200);
    expect(mockPrisma.friendship.update.mock.calls[0][0].data).toEqual({ status: 'accepted' });
  });

  it('rejects duplicates and self-adds', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'them' });
    mockPrisma.friendship.findFirst.mockResolvedValue({
      id: 'f',
      status: 'accepted',
      userAId: 'me',
    });
    expect((await POST(post('them@x.com'))).status).toBe(409);

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'me' });
    expect((await POST(post('me@x.com'))).status).toBe(400);
  });
});

describe('PATCH /api/friends/[id]', () => {
  const call = () =>
    PATCH(new NextRequest('http://localhost/api/friends/f1', { method: 'PATCH' }), {
      params: Promise.resolve({ id: 'f1' }),
    });

  it('lets only the recipient accept a pending request', async () => {
    mockPrisma.friendship.findUnique.mockResolvedValue({
      id: 'f1',
      userAId: 'them',
      userBId: 'me',
      status: 'pending',
    });
    mockPrisma.friendship.update.mockResolvedValue({ id: 'f1', status: 'accepted' });
    expect((await call()).status).toBe(200);
    expect(mockPrisma.notification.create).toHaveBeenCalled();
  });

  it('forbids the requester from accepting their own request', async () => {
    mockPrisma.friendship.findUnique.mockResolvedValue({
      id: 'f1',
      userAId: 'me',
      userBId: 'them',
      status: 'pending',
    });
    expect((await call()).status).toBe(403);
    expect(mockPrisma.friendship.update).not.toHaveBeenCalled();
  });

  it('404s for unknown requests', async () => {
    mockPrisma.friendship.findUnique.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
});
