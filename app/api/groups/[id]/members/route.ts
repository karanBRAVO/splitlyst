import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const addSchema = z.object({ email: z.string().email() });
const removeSchema = z.object({ userId: z.string() });

type Props = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId } = await props.params;

  const currentMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!currentMember || currentMember.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 });
  }

  try {
    const { email } = addSchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user)
      return NextResponse.json({ error: 'User not found with this email' }, { status: 404 });

    const existing = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: user.id, groupId } },
    });
    if (existing) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

    const member = await prisma.groupMember.create({
      data: { userId: user.id, groupId, role: 'member' },
      include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
    });

    // Auto-friend the new member with all existing group members
    const existingMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: user.id } },
      select: { userId: true },
    });
    for (const existing of existingMembers) {
      const [a, b] = [existing.userId, user.id].sort();
      await prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        update: {},
        create: { userAId: a, userBId: b, status: 'accepted' },
      });
    }

    await prisma.activity.create({
      data: {
        userId: session.user.id,
        groupId,
        type: 'member_added',
        description: `${session.user.name} added ${user.name} to the group`,
      },
    });

    return NextResponse.json(member, { status: 201 });
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

  const { id: groupId } = await props.params;

  const currentMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!currentMember) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const { userId } = removeSchema.parse(await req.json());

  if (userId !== session.user.id && currentMember.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 });
  }

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId, groupId } },
  });

  return NextResponse.json({ success: true });
}
