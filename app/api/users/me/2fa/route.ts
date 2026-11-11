import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { compare } from 'bcryptjs';
import QRCode from 'qrcode';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { generateRecoveryCodes, generateSecret, otpauthUrl, verifyTotp } from '@/lib/totp';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setup') }),
  z.object({ action: z.literal('enable'), code: z.string() }),
  z.object({ action: z.literal('disable'), password: z.string() }),
]);

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = rateLimit(`2fa:${session.user.id}:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const body = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (body.action === 'setup') {
    if (user.totpEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already on' },
        { status: 409 },
      );
    }
    // Store the pending secret; it only takes effect after a valid code is confirmed.
    const secret = generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
    const url = otpauthUrl(secret, user.email);
    return NextResponse.json({ secret, otpauthUrl: url, qr: await QRCode.toDataURL(url) });
  }

  if (body.action === 'enable') {
    if (user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: 'Start setup first' }, { status: 400 });
    }
    if (!verifyTotp(user.totpSecret, body.code)) {
      return NextResponse.json(
        { error: 'Invalid code. Check your authenticator app.' },
        { status: 400 },
      );
    }
    const { plain, hashed } = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpEnabled: true, recoveryCodes: hashed },
    });
    return NextResponse.json({ enabled: true, recoveryCodes: plain });
  }

  // disable
  if (!(await compare(body.password, user.password))) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, recoveryCodes: [] },
  });
  return NextResponse.json({ enabled: false });
}
