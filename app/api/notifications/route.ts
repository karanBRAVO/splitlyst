import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: unreadOnly ? undefined : 50,
  })

  if (unreadOnly) {
    return NextResponse.json({ count: notifications.length })
  }

  return NextResponse.json(notifications)
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const markAllRead = searchParams.get('markAllRead') === 'true'

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    })
    return NextResponse.json({ success: true })
  }

  const { id } = await req.json()
  await prisma.notification.update({ where: { id }, data: { read: true } })
  return NextResponse.json({ success: true })
}
