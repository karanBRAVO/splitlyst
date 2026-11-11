import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyMany } from '@/lib/notify';
import { escapeHtml, isEmailConfigured, sendEmail } from '@/lib/email';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
  calculateItemizedSplits,
  validateCustomSplits,
} from '@/lib/calculations';
import { formatCurrency, roundToTwoDecimals } from '@/lib/utils';

const splitSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percentage: z.number().min(0).max(100).optional(),
  shares: z.number().int().min(1).optional(),
});

const itemSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  assignedTo: z.array(z.string()).min(1),
});

const createSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  category: z.string().default('general'),
  date: z.string().datetime().optional(),
  groupId: z.string().optional().nullable(),
  paidById: z.string(),
  splitType: z.enum(['equal', 'percentage', 'shares', 'custom', 'itemized']).default('equal'),
  items: z.array(itemSchema).optional(),
  tax: z.number().min(0).optional(),
  tip: z.number().min(0).optional(),
  participants: z.array(z.string()),
  splits: z.array(splitSchema).optional(),
  notes: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().max(7_500_000).optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  const friendId = searchParams.get('friendId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const cursor = searchParams.get('cursor');
  const search = searchParams.get('search');
  const category = searchParams.get('category');
  // view=list: just what a list row needs (no comments/attachments) — much lighter for big groups
  const listView = searchParams.get('view') === 'list';

  let where: Prisma.ExpenseWhereInput = {};

  if (groupId) {
    // Verify membership
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    });
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    where.groupId = groupId;
  } else if (friendId) {
    where = {
      OR: [
        { paidById: session.user.id, splits: { some: { userId: friendId } } },
        { paidById: friendId, splits: { some: { userId: session.user.id } } },
      ],
      groupId: null,
    };
  } else {
    where = {
      OR: [{ paidById: session.user.id }, { splits: { some: { userId: session.user.id } } }],
    };
  }

  if (search) {
    where.description = { contains: search, mode: 'insensitive' };
  }
  if (category) {
    where.category = category;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: listView
      ? {
          paidBy: { select: { id: true, name: true, avatar: true } },
          splits: { select: { userId: true, amount: true } },
        }
      : {
          paidBy: { select: { id: true, name: true, avatar: true } },
          splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          comments: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
          },
          attachments: true,
          group: { select: { id: true, name: true, avatar: true } },
        },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  return NextResponse.json({
    expenses,
    nextCursor: expenses.length === limit ? expenses[expenses.length - 1].id : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      description,
      amount,
      currency,
      category,
      date,
      groupId,
      paidById,
      splitType,
      items,
      tax,
      tip,
      participants,
      splits,
      notes,
      receiptUrl,
      isRecurring,
      recurringInterval,
    } = createSchema.parse(body);

    if (groupId) {
      const g = await prisma.group.findUnique({
        where: { id: groupId },
        select: { isArchived: true },
      });
      if (g?.isArchived) {
        return NextResponse.json(
          { error: 'This group is archived. Unarchive it to add expenses.' },
          { status: 400 },
        );
      }
    }

    // Compute split amounts
    if (splitType === 'itemized') {
      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'Add at least one item' }, { status: 400 });
      }
      const expected = roundToTwoDecimals(
        items.reduce((s, i) => s + i.amount, 0) + (tax ?? 0) + (tip ?? 0),
      );
      if (Math.abs(expected - amount) > 0.02) {
        return NextResponse.json({ error: 'Total must equal items + tax + tip' }, { status: 400 });
      }
    }

    let computedSplits: Array<{
      userId: string;
      amount: number;
      percentage?: number;
      shares?: number;
    }> = [];

    if (splitType === 'itemized' && items) {
      computedSplits = calculateItemizedSplits(items, tax ?? 0, tip ?? 0).map((s) => ({
        ...s,
        amount: s.amount ?? 0,
      }));
    } else if (splitType === 'equal') {
      computedSplits = calculateEqualSplits(amount, participants).map((s) => ({
        ...s,
        amount: s.amount ?? 0,
      }));
    } else if (splitType === 'percentage' && splits) {
      computedSplits = calculatePercentageSplits(
        amount,
        splits.map((s) => ({ userId: s.userId, percentage: s.percentage })),
      ).map((s) => ({ ...s, amount: s.amount ?? 0 }));
    } else if (splitType === 'shares' && splits) {
      computedSplits = calculateSharesSplits(
        amount,
        splits.map((s) => ({ userId: s.userId, shares: s.shares })),
      ).map((s) => ({ ...s, amount: s.amount ?? 0 }));
    } else if (splitType === 'custom' && splits) {
      if (
        !validateCustomSplits(
          amount,
          splits.map((s) => ({ userId: s.userId, amount: s.amount || 0 })),
        )
      ) {
        return NextResponse.json(
          { error: 'Custom split amounts must sum to total' },
          { status: 400 },
        );
      }
      computedSplits = splits.map((s) => ({ userId: s.userId, amount: s.amount || 0 }));
    }

    let recurringId: string | undefined;
    if (isRecurring && recurringInterval) {
      const nextRun = new Date();
      if (recurringInterval === 'daily') nextRun.setDate(nextRun.getDate() + 1);
      else if (recurringInterval === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
      else if (recurringInterval === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
      else if (recurringInterval === 'yearly') nextRun.setFullYear(nextRun.getFullYear() + 1);

      const template = await prisma.recurringTemplate.create({
        data: {
          userId: session.user.id,
          description,
          amount,
          currency,
          category,
          splitType,
          interval: recurringInterval,
          nextRunAt: nextRun,
          groupId,
          data: { participants, splits, paidById },
        },
      });
      recurringId = template.id;
    }

    const expense = await prisma.expense.create({
      data: {
        description,
        amount,
        currency,
        category,
        date: date ? new Date(date) : new Date(),
        groupId: groupId || null,
        paidById,
        splitType,
        notes,
        tax: splitType === 'itemized' ? (tax ?? 0) : null,
        tip: splitType === 'itemized' ? (tip ?? 0) : null,
        ...(splitType === 'itemized' && items
          ? {
              items: {
                create: items.map((i) => ({
                  name: i.name,
                  amount: i.amount,
                  assignedTo: i.assignedTo,
                })),
              },
            }
          : {}),
        receiptUrl: receiptUrl || null,
        isRecurring,
        recurringId,
        splits: {
          create: computedSplits.map((s) => ({
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage,
            shares: s.shares,
          })),
        },
      },
      include: {
        paidBy: { select: { id: true, name: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        group: { select: { id: true, name: true } },
      },
    });

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: groupId || null,
        expenseId: expense.id,
        type: 'expense_added',
        description: `${session.user.name} added "${description}" (${formatCurrency(amount, currency)})`,
        metadata: { description, amount, currency },
      },
    });

    // Create notifications for other participants
    const otherParticipants = computedSplits.filter((s) => s.userId !== session.user.id);
    if (otherParticipants.length > 0) {
      await notifyMany(
        otherParticipants.map((s) => ({
          userId: s.userId,
          type: 'expense_added',
          title: 'New expense',
          message: `${session.user.name} added "${description}" — you owe ${formatCurrency(s.amount, currency)}`,
          data: { expenseId: expense.id },
          url: `/expenses/${expense.id}`,
        })),
      );
    }

    if (otherParticipants.length > 0 && isEmailConfigured()) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: otherParticipants.map((s) => s.userId) } },
        select: { id: true, email: true, name: true },
      });
      // Fire-and-forget: email failures must not fail the request
      void Promise.allSettled(
        recipients.map((u) => {
          const share = otherParticipants.find((s) => s.userId === u.id)?.amount ?? 0;
          const line = `${session.user.name} added "${description}" — your share is ${formatCurrency(share, currency)}.`;
          return sendEmail({
            to: u.email,
            subject: `New expense: ${description}`,
            text: `Hi ${u.name},\n\n${line}\n\n${process.env.NEXTAUTH_URL ?? ''}/expenses/${expense.id}`,
            html: `<p>Hi ${escapeHtml(u.name)},</p><p>${escapeHtml(line)}</p><p><a href="${process.env.NEXTAUTH_URL ?? ''}/expenses/${expense.id}">View expense</a></p>`,
          });
        }),
      );
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error('[expenses POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
