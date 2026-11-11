import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateGroupBalances, simplifyDebts } from '@/lib/calculations';
import { roundToTwoDecimals } from '@/lib/utils';
import { getExchangeRates, convertAmount } from '@/lib/currency';

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

  // Fetch rates once — used for both branches
  const rates = await getExchangeRates('USD');

  if (groupId) {
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [group, expenses, payments, members] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        select: { currency: true, simplifyDebts: true },
      }),
      prisma.expense.findMany({
        where: { groupId },
        include: { splits: true },
      }),
      prisma.payment.findMany({ where: { groupId } }),
      prisma.groupMember.findMany({
        where: { groupId },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      }),
    ]);

    // Use the group's own currency as the target so all members see consistent numbers
    const targetCurrency = group?.currency || 'USD';

    // Convert every split and payment amount to the group's currency
    const convertedExpenses = expenses.map((e) => ({
      ...e,
      splits: e.splits.map((s) => ({
        ...s,
        amount: convertAmount(s.amount, e.currency, targetCurrency, rates),
      })),
    }));
    const convertedPayments = payments.map((p) => ({
      ...p,
      amount: convertAmount(p.amount, p.currency, targetCurrency, rates),
    }));

    const netMap = calculateGroupBalances(convertedExpenses, convertedPayments);
    const users = members.map((m) => m.user);

    const balances = users.map((u) => {
      const userNet = netMap[u.id] || {};
      let owed = 0,
        owes = 0;
      for (const [, amt] of Object.entries(userNet)) {
        if (amt > 0) owed += amt;
        else owes += Math.abs(amt);
      }
      return {
        user: u,
        owed: roundToTwoDecimals(owed),
        owes: roundToTwoDecimals(owes),
        net: roundToTwoDecimals(owed - owes),
      };
    });

    const rawDebts: Array<{ owesToUserId: string; owedByUserId: string; amount: number }> = [];
    const seen = new Set<string>();
    for (const [aId, others] of Object.entries(netMap)) {
      for (const [bId, amt] of Object.entries(others)) {
        const key = [aId, bId].sort().join('-');
        if (!seen.has(key) && amt > 0) {
          seen.add(key);
          rawDebts.push({ owesToUserId: aId, owedByUserId: bId, amount: amt });
        }
      }
    }

    const useSimplify = group?.simplifyDebts !== false;
    const simplified = (useSimplify ? simplifyDebts(rawDebts) : rawDebts).map((d) => ({
      from: users.find((u) => u.id === d.owedByUserId),
      to: users.find((u) => u.id === d.owesToUserId),
      amount: d.amount,
    }));

    return NextResponse.json({
      balances,
      simplified,
      simplifyDebts: useSimplify,
      currency: targetCurrency,
    });
  }

  // ── Overall balances ────────────────────────────────────────────────────────

  const targetCurrency = session.user.currency || 'USD';

  const [expenses, payments] = await Promise.all([
    prisma.expense.findMany({
      where: {
        OR: [{ paidById: session.user.id }, { splits: { some: { userId: session.user.id } } }],
      },
      include: { splits: true, paidBy: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.payment.findMany({
      where: {
        OR: [{ payerId: session.user.id }, { receiverId: session.user.id }],
      },
    }),
  ]);

  // Convert every split and payment to the user's preferred currency
  const convertedExpenses = expenses.map((e) => ({
    ...e,
    splits: e.splits.map((s) => ({
      ...s,
      amount: convertAmount(s.amount, e.currency, targetCurrency, rates),
    })),
  }));
  const convertedPayments = payments.map((p) => ({
    ...p,
    amount: convertAmount(p.amount, p.currency, targetCurrency, rates),
  }));

  const netMap = calculateGroupBalances(convertedExpenses, convertedPayments);
  const userNet = netMap[session.user.id] || {};

  const otherUserIds = Object.keys(userNet).filter((id) => Math.abs(userNet[id]) > 0.01);

  const otherUsers = await prisma.user.findMany({
    where: { id: { in: otherUserIds } },
    select: { id: true, name: true, avatar: true, email: true },
  });

  const balances = otherUsers
    .map((u) => {
      const net = userNet[u.id] || 0;
      return {
        user: u,
        net: roundToTwoDecimals(net),
        owed: net > 0 ? roundToTwoDecimals(net) : 0,
        owes: net < 0 ? roundToTwoDecimals(Math.abs(net)) : 0,
      };
    })
    .filter((b) => Math.abs(b.net) > 0.01);

  const totalOwed = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.owed, 0);
  const totalOwes = balances.filter((b) => b.net < 0).reduce((s, b) => s + b.owes, 0);

  return NextResponse.json({
    balances,
    totalOwed: roundToTwoDecimals(totalOwed),
    totalOwes: roundToTwoDecimals(totalOwes),
    net: roundToTwoDecimals(totalOwed - totalOwes),
    currency: targetCurrency,
  });
}
