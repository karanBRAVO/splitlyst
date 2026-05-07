import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { isPro: true },
    select: { id: true, isPro: true },
  })

  return NextResponse.json(user)
}
