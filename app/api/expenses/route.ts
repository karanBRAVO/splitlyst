import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { calculateEqualSplits, calculatePercentageSplits, calculateSharesSplits, validateCustomSplits } from '@/lib/calculations'

const splitSchema = z.object({
  userId: z.string(),
  amount: z.number().optional(),
  percentage: z.number().min(0).max(100).optional(),
  shares: z.number().int().min(1).optional(),
})

const createSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  category: z.string().default('general'),
  date: z.string().datetime().optional(),
  groupId: z.string().optional().nullable(),
  paidById: z.string(),
  splitType: z.enum(['equal', 'percentage', 'shares', 'custom']).default('equal'),
  participants: z.array(z.string()),
  splits: z.array(splitSchema).optional(),
  notes: z.string().max(500).optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurringInterval: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')
  const friendId = searchParams.get('friendId')
  const limit = parseInt(searchParams.get('limit') || '50')
  const cursor = searchParams.get('cursor')
  const search = searchParams.get('search')
  const category = searchParams.get('category')

  let where: any = {}

  if (groupId) {
    // Verify membership
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: session.user.id, groupId } },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    where.groupId = groupId
  } else if (friendId) {
    where = {
      OR: [
        { paidById: session.user.id, splits: { some: { userId: friendId } } },
        { paidById: friendId, splits: { some: { userId: session.user.id } } },
      ],
      groupId: null,
    }
  } else {
    where = {
      OR: [
        { paidById: session.user.id },
        { splits: { some: { userId: session.user.id } } },
      ],
    }
  }

  if (search) {
    where.description = { contains: search, mode: 'insensitive' }
  }
  if (category) {
    where.category = category
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      paidBy: { select: { id: true, name: true, avatar: true } },
      splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      comments: { include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'asc' } },
      attachments: true,
      group: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  })

  return NextResponse.json({
    expenses,
    nextCursor: expenses.length === limit ? expenses[expenses.length - 1].id : null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { description, amount, currency, category, date, groupId, paidById, splitType, participants, splits, notes, isRecurring, recurringInterval } = createSchema.parse(body)

    // Compute split amounts
    let computedSplits: Array<{ userId: string; amount: number; percentage?: number; shares?: number }> = []

    if (splitType === 'equal') {
      computedSplits = calculateEqualSplits(amount, participants)
    } else if (splitType === 'percentage' && splits) {
      computedSplits = calculatePercentageSplits(amount, splits.map(s => ({ userId: s.userId, percentage: s.percentage })))
    } else if (splitType === 'shares' && splits) {
      computedSplits = calculateSharesSplits(amount, splits.map(s => ({ userId: s.userId, shares: s.shares })))
    } else if (splitType === 'custom' && splits) {
      if (!validateCustomSplits(amount, splits.map(s => ({ userId: s.userId, amount: s.amount || 0 })))) {
        return NextResponse.json({ error: 'Custom split amounts must sum to total' }, { status: 400 })
      }
      computedSplits = splits.map(s => ({ userId: s.userId, amount: s.amount || 0 }))
    }

    let recurringId: string | undefined
    if (isRecurring && recurringInterval) {
      const nextRun = new Date()
      if (recurringInterval === 'daily') nextRun.setDate(nextRun.getDate() + 1)
      else if (recurringInterval === 'weekly') nextRun.setDate(nextRun.getDate() + 7)
      else if (recurringInterval === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1)
      else if (recurringInterval === 'yearly') nextRun.setFullYear(nextRun.getFullYear() + 1)

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
          data: { participants, splits },
        },
      })
      recurringId = template.id
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
    })

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: groupId || null,
        expenseId: expense.id,
        type: 'expense_added',
        description: `${session.user.name} added "${description}" ($${amount.toFixed(2)})`,
      },
    })

    // Create notifications for other participants
    const otherParticipants = computedSplits.filter((s) => s.userId !== session.user.id)
    if (otherParticipants.length > 0) {
      await prisma.notification.createMany({
        data: otherParticipants.map((s) => ({
          userId: s.userId,
          type: 'expense_added',
          title: 'New expense',
          message: `${session.user.name} added "${description}" — you owe $${s.amount.toFixed(2)}`,
          data: { expenseId: expense.id },
        })),
      })
    }

    return NextResponse.json(expense, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[expenses POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
