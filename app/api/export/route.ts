import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  const type = searchParams.get('type') || 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;
  if ((fromDate && isNaN(fromDate.getTime())) || (toDate && isNaN(toDate.getTime()))) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  const expenses = await prisma.expense.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      ...(fromDate || toDate
        ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
      OR: [{ paidById: session.user.id }, { splits: { some: { userId: session.user.id } } }],
    },
    include: {
      paidBy: { select: { name: true } },
      splits: {
        where: { userId: session.user.id },
        include: { user: { select: { name: true } } },
      },
      group: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  });

  if (type === 'json') {
    return NextResponse.json(
      expenses.map((e) => ({
        date: format(new Date(e.date), 'yyyy-MM-dd'),
        description: e.description,
        category: e.category,
        total: e.amount,
        currency: e.currency,
        paidBy: e.paidBy.name,
        yourShare: e.splits[0]?.amount || 0,
        group: e.group?.name || 'Personal',
      })),
    );
  }

  // CSV export
  const rows = [
    ['Date', 'Description', 'Category', 'Total', 'Currency', 'Paid By', 'Your Share', 'Group'].join(
      ',',
    ),
    ...expenses.map((e) =>
      [
        format(new Date(e.date), 'yyyy-MM-dd'),
        `"${e.description.replace(/"/g, '""')}"`,
        e.category,
        e.amount,
        e.currency,
        `"${e.paidBy.name}"`,
        e.splits[0]?.amount || 0,
        `"${e.group?.name || 'Personal'}"`,
      ].join(','),
    ),
  ].join('\n');

  return new NextResponse(rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="splitlyst-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
    },
  });
}
