import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  receiverId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  groupId: z.string().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
})

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')

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
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { receiverId, amount, currency, groupId, notes } = schema.parse(body)

    if (receiverId === session.user.id) {
      return NextResponse.json({ error: 'Cannot pay yourself' }, { status: 400 })
    }

    const payment = await prisma.payment.create({
      data: {
        payerId: session.user.id,
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
    })

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: groupId || null,
        type: 'payment_recorded',
        description: `${session.user.name} paid ${payment.receiver.name} $${amount.toFixed(2)}`,
      },
    })

    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: 'payment_received',
        title: 'Payment received',
        message: `${session.user.name} paid you $${amount.toFixed(2)}`,
        data: { paymentId: payment.id },
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[payments POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
