import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  category: z.string().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

type Props = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: { select: { id: true, name: true, avatar: true, email: true } },
      splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      comments: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: true,
      items: true,
      group: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const hasAccess =
    expense.paidById === session.user.id ||
    expense.splits.some((s) => s.userId === session.user.id) ||
    (expense.groupId &&
      (await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: session.user.id, groupId: expense.groupId } },
      })));

  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json(expense);
}

export async function PATCH(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (expense.paidById !== session.user.id) {
    return NextResponse.json({ error: 'Only the payer can edit this expense' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const updated = await prisma.expense.update({
      where: { id },
      data: { ...data, ...(data.date ? { date: new Date(data.date) } : {}) },
      include: {
        paidBy: { select: { id: true, name: true, avatar: true } },
        splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        group: { select: { id: true, name: true } },
      },
    });

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: expense.groupId,
        expenseId: expense.id,
        type: 'expense_updated',
        description: `${session.user.name} updated "${updated.description}"`,
        metadata: {
          description: updated.description,
          amount: updated.amount,
          currency: updated.currency,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (expense.paidById !== session.user.id) {
    return NextResponse.json({ error: 'Only the payer can delete this expense' }, { status: 403 });
  }

  await prisma.activity.create({
    data: {
      userId: session.user.id,
      groupId: expense.groupId,
      type: 'expense_deleted',
      description: `${session.user.name} deleted "${expense.description}"`,
      metadata: {
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
      },
    },
  });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
