jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { dedupeFriends } from '@/lib/friends';

const row = (id: string, status: string, createdAt: string, rowId = id + status + createdAt) => ({
  rowId,
  status,
  createdAt,
  friend: { id },
});

describe('dedupeFriends', () => {
  it('keeps one entry per person', () => {
    const out = dedupeFriends([
      row('bob', 'accepted', '2024-01-02'),
      row('bob', 'accepted', '2024-01-01'),
      row('carol', 'accepted', '2024-01-03'),
    ]);
    expect(out.map((r) => r.friend.id).sort()).toEqual(['bob', 'carol']);
  });

  it('prefers accepted over pending, regardless of order', () => {
    const a = dedupeFriends([
      row('bob', 'pending', '2024-01-01'),
      row('bob', 'accepted', '2024-01-05'),
    ]);
    const b = dedupeFriends([
      row('bob', 'accepted', '2024-01-05'),
      row('bob', 'pending', '2024-01-01'),
    ]);
    expect(a).toHaveLength(1);
    expect(a[0].status).toBe('accepted');
    expect(b[0].status).toBe('accepted');
  });

  it('prefers the oldest row when statuses match', () => {
    const out = dedupeFriends([
      row('bob', 'accepted', '2024-02-01', 'new'),
      row('bob', 'accepted', '2024-01-01', 'old'),
    ]);
    expect(out[0].rowId).toBe('old');
  });
});
