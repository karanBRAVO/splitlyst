import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const { token, password } = schema.parse(await req.json())

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }
    if (resetToken.usedAt) {
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 })
    }
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Reset link has expired. Request a new one.' },
        { status: 400 }
      )
    }

    const hashed = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
