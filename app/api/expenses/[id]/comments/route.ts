import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({ text: z.string().min(1).max(1000) });

type Props = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: expenseId } = await props.params;

  try {
    const { text } = schema.parse(await req.json());
    const comment = await prisma.comment.create({
      data: { expenseId, userId: session.user.id, text },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
