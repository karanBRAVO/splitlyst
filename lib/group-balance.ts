import { prisma } from '@/lib/prisma';
import { calculateGroupBalances } from '@/lib/calculations';
import { convertAmount, getExchangeRates } from '@/lib/currency';

/** Sum of what others owe `userId` (positive) minus what `userId` owes others, from a pairwise net map. */
export function netForUser(netMap: Record<string, Record<string, number>>, userId: string): number {
  return Object.values(netMap[userId] ?? {}).reduce((sum, v) => sum + v, 0);
}

/** Net balance of a user in a group, expressed in the group's currency. */
export async function getUserGroupNet(groupId: string, userId: string): Promise<number> {
  const [group, expenses, payments, rates] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { currency: true } }),
    prisma.expense.findMany({ where: { groupId }, include: { splits: true } }),
    prisma.payment.findMany({ where: { groupId } }),
    getExchangeRates('USD'),
  ]);
  const target = group?.currency || 'USD';
  const netMap = calculateGroupBalances(
    expenses.map((e) => ({
      paidById: e.paidById,
      splits: e.splits.map((s) => ({
        userId: s.userId,
        amount: convertAmount(s.amount, e.currency, target, rates),
      })),
    })),
    payments.map((p) => ({
      payerId: p.payerId,
      receiverId: p.receiverId,
      amount: convertAmount(p.amount, p.currency, target, rates),
    })),
  );
  return netForUser(netMap, userId);
}

/** What `payer` currently owes `receiver`, from a pairwise net map (never negative). */
export function pairOwed(
  netMap: Record<string, Record<string, number>>,
  payerId: string,
  receiverId: string,
): number {
  // net[A][B] > 0 means B owes A
  return Math.max(0, netMap[receiverId]?.[payerId] ?? 0);
}

/**
 * How much `payerId` owes `receiverId`, in `currency` — within one group, or across everything
 * between the two when `groupId` is null. Used to validate recorded payments.
 */
export async function getPairOwed(
  payerId: string,
  receiverId: string,
  groupId: string | null,
  currency: string,
): Promise<number> {
  const both = [payerId, receiverId];
  const [expenses, payments, rates] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        paidById: { in: both },
        splits: { some: { userId: { in: both } } },
      },
      include: { splits: true },
    }),
    prisma.payment.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        payerId: { in: both },
        receiverId: { in: both },
      },
    }),
    getExchangeRates('USD'),
  ]);

  const netMap = calculateGroupBalances(
    expenses.map((e) => ({
      paidById: e.paidById,
      // only the two people's shares matter for the pair
      splits: e.splits
        .filter((s) => both.includes(s.userId))
        .map((s) => ({
          userId: s.userId,
          amount: convertAmount(s.amount, e.currency, currency, rates),
        })),
    })),
    payments.map((p) => ({
      payerId: p.payerId,
      receiverId: p.receiverId,
      amount: convertAmount(p.amount, p.currency, currency, rates),
    })),
  );
  return pairOwed(netMap, payerId, receiverId);
}
