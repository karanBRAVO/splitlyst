import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notify';

type Props = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Only the recipient of a pending request can accept it
  if (friendship.userBId !== session.user.id || friendship.status !== 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.friendship.update({ where: { id }, data: { status: 'accepted' } });
  await notify({
    userId: friendship.userAId,
    type: 'friend_added',
    title: 'Friend request accepted',
    message: `${session.user.name} accepted your friend request`,
    data: { userId: session.user.id },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await props.params;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (friendship.userAId !== session.user.id && friendship.userBId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Remove every row between the pair (older data may contain one in each direction)
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userAId: friendship.userAId, userBId: friendship.userBId },
        { userAId: friendship.userBId, userBId: friendship.userAId },
      ],
    },
  });
  return NextResponse.json({ success: true });
}
