jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { netForUser } from '@/lib/group-balance';
import { calculateGroupBalances } from '@/lib/calculations';

describe('netForUser', () => {
  it('is zero for an unknown user', () => {
    expect(netForUser({}, 'x')).toBe(0);
  });

  it('sums what a user is owed minus what they owe', () => {
    const net = calculateGroupBalances(
      [
        {
          paidById: 'a',
          splits: [
            { userId: 'a', amount: 10 },
            { userId: 'b', amount: 10 },
          ],
        },
        {
          paidById: 'b',
          splits: [
            { userId: 'a', amount: 4 },
            { userId: 'b', amount: 4 },
          ],
        },
      ],
      [],
    );
    expect(netForUser(net, 'a')).toBeCloseTo(6, 2); // owed 10, owes 4
    expect(netForUser(net, 'b')).toBeCloseTo(-6, 2);
  });

  it('is zero once a payment settles the debt', () => {
    const net = calculateGroupBalances(
      [{ paidById: 'a', splits: [{ userId: 'b', amount: 10 }] }],
      [{ payerId: 'b', receiverId: 'a', amount: 10 }],
    );
    expect(netForUser(net, 'a')).toBeCloseTo(0, 2);
  });
});
