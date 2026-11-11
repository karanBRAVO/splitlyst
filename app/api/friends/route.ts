import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dedupeFriends } from '@/lib/friends';
import { notify } from '@/lib/notify';
import { z } from 'zod';

export async function GET(_req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: session.user.id }, { userBId: session.user.id }],
    },
    include: {
      userA: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
          venmo: true,
          paypal: true,
          upi: true,
        },
      },
      userB: {
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
          venmo: true,
          paypal: true,
          upi: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Return the friend (the other person)
  const friends = friendships.map((f) => ({
    id: f.id,
    status: f.status,
    createdAt: f.createdAt,
    friend: f.userAId === session.user.id ? f.userB : f.userA,
    isRequester: f.userAId === session.user.id,
    isIncoming: f.status === 'pending' && f.userBId === session.user.id,
  }));

  return NextResponse.json(dedupeFriends(friends));
}

const addSchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { email } = addSchema.parse(await req.json());

    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!target)
      return NextResponse.json({ error: 'No user found with this email' }, { status: 404 });
    if (target.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: session.user.id, userBId: target.id },
          { userAId: target.id, userBId: session.user.id },
        ],
      },
    });
    if (existing) {
      // They already asked us: adding them back accepts their request.
      if (existing.status === 'pending' && existing.userAId === target.id) {
        const accepted = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted' },
          include: {
            userA: { select: { id: true, name: true, avatar: true, email: true } },
            userB: { select: { id: true, name: true, avatar: true, email: true } },
          },
        });
        return NextResponse.json(accepted, { status: 200 });
      }
      return NextResponse.json(
        {
          error:
            existing.status === 'pending'
              ? 'Friend request already sent'
              : 'You are already friends',
        },
        { status: 409 },
      );
    }

    const friendship = await prisma.friendship.create({
      data: { userAId: session.user.id, userBId: target.id, status: 'pending' },
      include: {
        userA: { select: { id: true, name: true, avatar: true, email: true } },
        userB: { select: { id: true, name: true, avatar: true, email: true } },
      },
    });

    await notify({
      userId: target.id,
      type: 'friend_request',
      title: 'Friend request',
      message: `${session.user.name} sent you a friend request`,
      data: { userId: session.user.id },
    });

    return NextResponse.json(friendship, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
