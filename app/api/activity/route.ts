import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  const limit = parseInt(searchParams.get('limit') || '30');

  // Get groups user is in
  const userGroups = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  });
  const groupIds = userGroups.map((g) => g.groupId);

  const activities = await prisma.activity.findMany({
    where: {
      ...(groupId
        ? { groupId }
        : {
            OR: [
              { userId: session.user.id },
              { groupId: { in: groupIds } },
              // expenses someone else added where you have a share (e.g. with a friend, no group)
              { expense: { splits: { some: { userId: session.user.id } } } },
              // payments to or from you
              { metadata: { path: ['payerId'], equals: session.user.id } },
              { metadata: { path: ['receiverId'], equals: session.user.id } },
            ],
          }),
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      group: { select: { id: true, name: true } },
      expense: {
        select: {
          id: true,
          description: true,
          amount: true,
          currency: true,
          paidById: true,
          splits: { select: { userId: true, amount: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const me = session.user.id;
  const enriched = activities.map(({ expense, ...a }) => {
    let impact: {
      kind: 'lent' | 'borrowed' | 'paid' | 'received';
      amount: number;
      currency: string;
    } | null = null;

    if (expense && (a.type === 'expense_added' || a.type === 'expense_updated')) {
      const myShare = expense.splits.find((sp) => sp.userId === me)?.amount ?? 0;
      if (expense.paidById === me) {
        const lent = Math.round((expense.amount - myShare) * 100) / 100;
        if (lent > 0.004) impact = { kind: 'lent', amount: lent, currency: expense.currency };
      } else if (myShare > 0) {
        impact = { kind: 'borrowed', amount: myShare, currency: expense.currency };
      }
    } else if (a.type === 'payment_recorded') {
      const m = (a.metadata ?? {}) as {
        amount?: number;
        currency?: string;
        payerId?: string;
        receiverId?: string;
      };
      if (typeof m.amount === 'number' && m.currency) {
        if (m.payerId === me) impact = { kind: 'paid', amount: m.amount, currency: m.currency };
        else if (m.receiverId === me)
          impact = { kind: 'received', amount: m.amount, currency: m.currency };
      }
    }

    return {
      ...a,
      expense: expense
        ? {
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            currency: expense.currency,
          }
        : null,
      impact,
    };
  });

  return NextResponse.json(enriched);
}
