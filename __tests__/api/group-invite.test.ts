const mockPrisma = {
  group: { findUnique: jest.fn(), update: jest.fn() },
  groupMember: { findUnique: jest.fn(), upsert: jest.fn() },
  activity: { create: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
const mockGetAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ getAuth: () => mockGetAuth() }));

import { NextRequest } from 'next/server';
import { POST as createInvite, DELETE as revokeInvite } from '@/app/api/groups/[id]/invite/route';
import { GET as preview, POST as join } from '@/app/api/groups/join/[code]/route';

const session = { user: { id: 'me', name: 'Me' } };
const r = (method = 'POST') => new NextRequest('http://localhost/x', { method });
const gid = { params: Promise.resolve({ id: 'g1' }) };
const code = { params: Promise.resolve({ code: 'abc' }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAuth.mockResolvedValue(session);
});

describe('invite links', () => {
  it('only admins can create or revoke', async () => {
    mockPrisma.groupMember.findUnique.mockResolvedValue({ role: 'member' });
    expect((await createInvite(r(), gid)).status).toBe(403);
    expect((await revokeInvite(r('DELETE'), gid)).status).toBe(403);
    expect(mockPrisma.group.update).not.toHaveBeenCalled();
  });

  it('admin gets a url-safe random code', async () => {
    mockPrisma.groupMember.findUnique.mockResolvedValue({ role: 'admin' });
    const body = await (await createInvite(r(), gid)).json();
    expect(body.inviteCode).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(mockPrisma.group.update.mock.calls[0][0].data.inviteCode).toBe(body.inviteCode);
  });

  it('revoking clears the code', async () => {
    mockPrisma.groupMember.findUnique.mockResolvedValue({ role: 'admin' });
    expect((await revokeInvite(r('DELETE'), gid)).status).toBe(200);
    expect(mockPrisma.group.update.mock.calls[0][0].data).toEqual({ inviteCode: null });
  });
});

describe('joining via link', () => {
  it('404s for an unknown or archived group', async () => {
    mockPrisma.group.findUnique.mockResolvedValue(null);
    expect((await preview(r('GET'), code)).status).toBe(404);
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g1', isArchived: true });
    expect((await join(r(), code)).status).toBe(404);
  });

  it('adds the user as a plain member', async () => {
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g1', isArchived: false });
    const res = await join(r(), code);
    expect(res.status).toBe(200);
    expect(mockPrisma.groupMember.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'me',
      groupId: 'g1',
      role: 'member',
    });
  });

  it('requires auth', async () => {
    mockGetAuth.mockResolvedValue(null);
    expect((await join(r(), code)).status).toBe(401);
  });
});
