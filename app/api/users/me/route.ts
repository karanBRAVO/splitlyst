import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hash, compare } from 'bcryptjs';

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  phone: z.string().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
});

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

export async function GET(_req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      currency: true,
      timezone: true,
      phone: true,
      bio: true,
      isPro: true,
      createdAt: true,
      _count: {
        select: { paidExpenses: true, groupMembers: true, friendsAsA: true, friendsAsB: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();

    if (body.currentPassword) {
      // Password change
      const { currentPassword, newPassword } = passwordSchema.parse(body);
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const valid = await compare(currentPassword, user.password);
      if (!valid)
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

      const hashed = await hash(newPassword, 12);
      await prisma.user.update({ where: { id: session.user.id }, data: { password: hashed } });
      return NextResponse.json({ success: true });
    }

    const data = updateSchema.parse(body);
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        currency: true,
        timezone: true,
        phone: true,
        bio: true,
        isPro: true,
      },
    });
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
