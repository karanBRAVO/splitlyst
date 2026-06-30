import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  currency: z.string().length(3).optional(),
  category: z.string().optional(),
  avatar: z.string().url().optional().nullable(),
  isArchived: z.boolean().optional(),
});

type Props = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: id } },
  });
  if (!member) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, avatar: true, email: true, currency: true } },
        },
      },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, avatar: true } },
          splits: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      },
      _count: { select: { expenses: true, members: true } },
    },
  });

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: id } },
  });
  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can edit groups' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const group = await prisma.group.update({ where: { id }, data });
    return NextResponse.json(group);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: id } },
  });
  if (!member || member.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete groups' }, { status: 403 });
  }

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
