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
  venmo: z.string().max(60).optional().nullable(),
  paypal: z.string().max(60).optional().nullable(),
  upi: z.string().max(80).optional().nullable(),
  locale: z.enum(['en', 'es', 'fr', 'de', 'hi']).optional(),
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
      venmo: true,
      paypal: true,
      upi: true,
      emailVerified: true,
      totpEnabled: true,
      locale: true,
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
        venmo: true,
        paypal: true,
        upi: true,
        emailVerified: true,
        totpEnabled: true,
        locale: true,
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

const deleteSchema = z.object({ password: z.string().min(1) });

/**
 * Delete the account. Because expenses/payments reference users, the account is anonymised
 * (shared history stays consistent for other people) and all personal data is removed.
 */
export async function DELETE(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!(await compare(parsed.data.password, user.password))) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
  }

  const id = user.id;
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.recurringTemplate.deleteMany({ where: { userId: id } }),
    prisma.friendship.deleteMany({ where: { OR: [{ userAId: id }, { userBId: id }] } }),
    prisma.user.update({
      where: { id },
      data: {
        name: 'Deleted user',
        email: `deleted-${id}@deleted.invalid`,
        password: await hash(crypto.randomUUID(), 12),
        avatar: null,
        phone: null,
        bio: null,
        venmo: null,
        paypal: null,
        upi: null,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
