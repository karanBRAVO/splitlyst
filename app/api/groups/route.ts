import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).default('USD'),
  category: z.string().default('other'),
  memberEmails: z.array(z.string().email()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      isArchived: false,
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
      },
      _count: { select: { expenses: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(groups)
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, description, currency, category, memberEmails } = createSchema.parse(body)

    const group = await prisma.group.create({
      data: {
        name,
        description,
        currency,
        category,
        members: {
          create: { userId: session.user.id, role: 'admin' },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
        },
      },
    })

    // Invite additional members by email
    if (memberEmails && memberEmails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: memberEmails.map((e) => e.toLowerCase()) } },
      })
      if (users.length > 0) {
        await prisma.groupMember.createMany({
          data: users.map((u) => ({ userId: u.id, groupId: group.id, role: 'member' })),
          skipDuplicates: true,
        })
      }
    }

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId: group.id,
        type: 'group_created',
        description: `${session.user.name} created group "${name}"`,
      },
    })

    return NextResponse.json(group, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[groups POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
