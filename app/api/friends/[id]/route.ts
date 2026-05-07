import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, props: Props) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await props.params

  const friendship = await prisma.friendship.findUnique({ where: { id } })
  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (friendship.userAId !== session.user.id && friendship.userBId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.friendship.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
