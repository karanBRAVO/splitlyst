import { prisma } from '@/lib/prisma';

/**
 * Make two users friends exactly once, whichever direction an earlier request went.
 * (The unique key is (userAId, userBId), so (A,B) and (B,A) are different rows — checking only one
 * direction is what used to create duplicate friend entries.)
 */
export async function ensureFriendship(userId1: string, userId2: string): Promise<void> {
  if (userId1 === userId2) return;
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: userId1, userBId: userId2 },
        { userAId: userId2, userBId: userId1 },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) {
    await prisma.friendship.create({
      data: { userAId: userId1, userBId: userId2, status: 'accepted' },
    });
  } else if (existing.status !== 'accepted') {
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted' } });
  }
}

type FriendRow = { status: string; createdAt: Date | string; friend: { id: string } };

/** Collapse duplicate rows for the same person: accepted beats pending, then the oldest wins. */
export function dedupeFriends<T extends FriendRow>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const current = best.get(row.friend.id);
    if (!current) {
      best.set(row.friend.id, row);
      continue;
    }
    const betterStatus = row.status === 'accepted' && current.status !== 'accepted';
    const sameStatus = row.status === current.status;
    const older = new Date(row.createdAt) < new Date(current.createdAt);
    if (betterStatus || (sameStatus && older)) best.set(row.friend.id, row);
  }
  return [...best.values()];
}
