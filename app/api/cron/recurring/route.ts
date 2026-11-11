import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import {
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
} from '@/lib/calculations';

type TemplateData = {
  participants?: string[];
  splits?: Array<{ userId: string; amount?: number; percentage?: number; shares?: number }>;
  paidById?: string;
};

function advance(date: Date, interval: string): Date {
  switch (interval) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'yearly':
      return addYears(date, 1);
    default:
      return addMonths(date, 1);
  }
}

// Called by Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.recurringTemplate.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
  });

  let created = 0;
  const failed: string[] = [];

  for (const t of due) {
    try {
      const data = (t.data ?? {}) as TemplateData;
      const participants = data.participants ?? [];
      const splits = data.splits;
      const paidById = data.paidById ?? t.userId;

      let computed: Array<{ userId: string; amount: number; percentage?: number; shares?: number }>;
      if (t.splitType === 'percentage' && splits) {
        computed = calculatePercentageSplits(
          t.amount,
          splits.map((s) => ({ userId: s.userId, percentage: s.percentage })),
        ).map((s) => ({ ...s, amount: s.amount ?? 0 }));
      } else if (t.splitType === 'shares' && splits) {
        computed = calculateSharesSplits(
          t.amount,
          splits.map((s) => ({ userId: s.userId, shares: s.shares })),
        ).map((s) => ({ ...s, amount: s.amount ?? 0 }));
      } else if (t.splitType === 'custom' && splits) {
        computed = splits.map((s) => ({ userId: s.userId, amount: s.amount ?? 0 }));
      } else {
        computed = calculateEqualSplits(t.amount, participants).map((s) => ({
          ...s,
          amount: s.amount ?? 0,
        }));
      }

      // Skip missed occurrences: move nextRunAt to the first future date.
      let next = advance(t.nextRunAt, t.interval);
      while (next <= now) next = advance(next, t.interval);

      // One atomic batch (not an interactive transaction): on a high-latency database an
      // interactive transaction can fail to even start in time.
      const expenseId = randomUUID();
      const others = computed.filter((s) => s.userId !== paidById);
      await prisma.$transaction([
        prisma.expense.create({
          data: {
            id: expenseId,
            description: t.description,
            amount: t.amount,
            currency: t.currency,
            category: t.category,
            date: now,
            groupId: t.groupId,
            paidById,
            splitType: t.splitType,
            isRecurring: true,
            recurringId: t.id,
            splits: {
              create: computed.map((s) => ({
                userId: s.userId,
                amount: s.amount,
                percentage: s.percentage,
                shares: s.shares,
              })),
            },
          },
        }),
        prisma.recurringTemplate.update({ where: { id: t.id }, data: { nextRunAt: next } }),
        prisma.activity.create({
          data: {
            userId: t.userId,
            groupId: t.groupId,
            expenseId,
            type: 'expense_added',
            description: `Recurring expense "${t.description}" was added`,
            metadata: { description: t.description, amount: t.amount, currency: t.currency },
          },
        }),
        ...(others.length > 0
          ? [
              prisma.notification.createMany({
                data: others.map((s) => ({
                  userId: s.userId,
                  type: 'expense_added',
                  title: 'Recurring expense',
                  message: `"${t.description}" was added — you owe ${formatCurrency(s.amount, t.currency)}`,
                  data: { expenseId },
                })),
              }),
            ]
          : []),
      ]);
      created++;
    } catch (err) {
      console.error('[cron recurring]', t.id, err);
      failed.push(t.id);
    }
  }

  return NextResponse.json({ due: due.length, created, failed });
}
