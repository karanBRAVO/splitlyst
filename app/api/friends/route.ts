import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }],
    },
    include: {
      userA: { select: { id: true, name: true, avatar: true, email: true } },
      userB: { select: { id: true, name: true, avatar: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Return the friend (the other person)
  const friends = friendships.map((f) => ({
    id: f.id,
    status: f.status,
    createdAt: f.createdAt,
    friend: f.userAId === session.user.id ? f.userB : f.userA,
    isRequester: f.userAId === session.user.id,
  }))

  return NextResponse.json(friends)
}

const addSchema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email } = addSchema.parse(await req.json())

    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!target) return NextResponse.json({ error: 'No user found with this email' }, { status: 404 })
    if (target.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 })
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: session.user.id, userBId: target.id },
          { userAId: target.id, userBId: session.user.id },
        ],
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Already friends or request pending' }, { status: 409 })
    }

    const friendship = await prisma.friendship.create({
      data: { userAId: session.user.id, userBId: target.id, status: 'accepted' },
      include: {
        userA: { select: { id: true, name: true, avatar: true, email: true } },
        userB: { select: { id: true, name: true, avatar: true, email: true } },
      },
    })

    await prisma.notification.create({
      data: {
        userId: target.id,
        type: 'friend_added',
        title: 'New friend',
        message: `${session.user.name} added you as a friend`,
        data: { userId: session.user.id },
      },
    })

    return NextResponse.json(friendship, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
