import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ id: string }> };

async function requireAdmin(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  return member?.role === 'admin';
}

// Create (or rotate) the invite link for a group. Admins only.
export async function POST(_req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await props.params;
  if (!(await requireAdmin(id, session.user.id))) {
    return NextResponse.json({ error: 'Only admins can create invite links' }, { status: 403 });
  }
  const inviteCode = crypto.randomBytes(12).toString('base64url');
  await prisma.group.update({ where: { id }, data: { inviteCode } });
  return NextResponse.json({ inviteCode });
}

// Revoke the invite link. Admins only.
export async function DELETE(_req: NextRequest, props: Props) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await props.params;
  if (!(await requireAdmin(id, session.user.id))) {
    return NextResponse.json({ error: 'Only admins can revoke invite links' }, { status: 403 });
  }
  await prisma.group.update({ where: { id }, data: { inviteCode: null } });
  return NextResponse.json({ success: true });
}
