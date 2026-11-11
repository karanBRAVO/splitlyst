import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import { getPairOwed } from '@/lib/group-balance';
import { notify } from '@/lib/notify';
import { z } from 'zod';

const schema = z.object({
  // Defaults to the signed-in user. Either side of a debt may record the payment.
  payerId: z.string().optional(),
  receiverId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  groupId: z.string().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');

  const payments = await prisma.payment.findMany({
    where: {
      OR: [{ payerId: session.user.id }, { receiverId: session.user.id }],
      ...(groupId ? { groupId } : {}),
    },
    include: {
      payer: { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const {
      payerId: bodyPayerId,
      receiverId,
      amount,
      currency,
      groupId,
      notes,
    } = schema.parse(body);
    const payerId = bodyPayerId ?? session.user.id;

    if (payerId === receiverId) {
      return NextResponse.json({ error: 'Cannot pay yourself' }, { status: 400 });
    }
    // You can only record payments you are part of
    if (session.user.id !== payerId && session.user.id !== receiverId) {
      return NextResponse.json({ error: 'You are not part of this payment' }, { status: 403 });
    }
    if (groupId) {
      const members = await prisma.groupMember.count({
        where: { groupId, userId: { in: [payerId, receiverId] } },
      });
      if (members !== 2) {
        return NextResponse.json({ error: 'Both people must be in the group' }, { status: 400 });
      }
    }

    // The amount is calculated, not free-form: it can't exceed what the payer actually owes
    const owed = await getPairOwed(payerId, receiverId, groupId ?? null, currency);
    if (owed < 0.005) {
      return NextResponse.json(
        { error: 'There is nothing to settle between you' },
        { status: 400 },
      );
    }
    if (amount > owed + 0.02) {
      return NextResponse.json(
        { error: `The amount outstanding is ${formatCurrency(owed, currency)}` },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.create({
      data: {
        payerId,
        receiverId,
        amount,
        currency,
        groupId: groupId || null,
        notes,
      },
      include: {
        payer: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    });

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: groupId || null,
        type: 'payment_recorded',
        description: `${payment.payer.name} paid ${payment.receiver.name} ${formatCurrency(amount, currency)}`,
        metadata: {
          amount,
          currency,
          payerId,
          payerName: payment.payer.name,
          receiverId,
          receiverName: payment.receiver.name,
        },
      },
    });

    // Tell the other person (the payer if the receiver recorded it, otherwise the receiver)
    const recordedByReceiver = session.user.id === receiverId;
    await notify({
      userId: recordedByReceiver ? payerId : receiverId,
      type: 'payment_received',
      title: recordedByReceiver ? 'Payment recorded' : 'Payment received',
      message: recordedByReceiver
        ? `${session.user.name} recorded that you paid ${formatCurrency(amount, currency)}`
        : `${session.user.name} paid you ${formatCurrency(amount, currency)}`,
      data: { paymentId: payment.id },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error('[payments POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
