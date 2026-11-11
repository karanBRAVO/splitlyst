import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ code: string }> };

// Preview the group behind an invite link.
export async function GET(_req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await props.params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      description: true,
      isArchived: true,
      _count: { select: { members: true } },
    },
  });
  if (!group || group.isArchived) {
    return NextResponse.json({ error: 'Invite link is invalid or expired' }, { status: 404 });
  }
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
  });
  return NextResponse.json({ ...group, alreadyMember: !!existing });
}

// Join the group via invite link.
export async function POST(_req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await props.params;

  const group = await prisma.group.findUnique({ where: { inviteCode: code } });
  if (!group || group.isArchived) {
    return NextResponse.json({ error: 'Invite link is invalid or expired' }, { status: 404 });
  }

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: session.user.id, groupId: group.id } },
    update: {},
    create: { userId: session.user.id, groupId: group.id, role: 'member' },
  });

  await prisma.activity.create({
    data: {
      userId: session.user.id,
      groupId: group.id,
      type: 'member_added',
      description: `${session.user.name} joined the group via invite link`,
    },
  });

  return NextResponse.json({ groupId: group.id });
}
