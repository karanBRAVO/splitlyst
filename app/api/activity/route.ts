import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')
  const limit = parseInt(searchParams.get('limit') || '30')

  // Get groups user is in
  const userGroups = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    select: { groupId: true },
  })
  const groupIds = userGroups.map((g) => g.groupId)

  const activities = await prisma.activity.findMany({
    where: {
      ...(groupId
        ? { groupId }
        : {
            OR: [
              { userId: session.user.id },
              { groupId: { in: groupIds } },
            ],
          }),
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      group: { select: { id: true, name: true } },
      expense: { select: { id: true, description: true, amount: true, currency: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(activities)
}
