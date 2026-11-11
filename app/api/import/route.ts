import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseSplitwiseCsv, planImport } from '@/lib/splitwise-import';

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

const schema = z.object({
  groupId: z.string(),
  csv: z.string().min(1).max(MAX_CSV_BYTES),
  /** Optional manual mapping: CSV member name -> userId (overrides name matching) */
  mapping: z.record(z.string(), z.string()).optional(),
  /** When true, only report what would be imported */
  dryRun: z.boolean().default(false),
});

// Import a Splitwise CSV export into one of your groups.
export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsedBody = schema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0].message }, { status: 400 });
  }
  const { groupId, csv, mapping, dryRun } = parsedBody.data;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!group || !group.members.some((m) => m.userId === session.user.id)) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
  if (group.isArchived) {
    return NextResponse.json({ error: 'This group is archived' }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseSplitwiseCsv(csv);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `That file has ${parsed.rows.length} rows; the limit is ${MAX_ROWS} per import` },
      { status: 400 },
    );
  }

  // CSV name -> userId
  const byName = new Map(group.members.map((m) => [m.user.name.trim().toLowerCase(), m.userId]));
  const memberIds = new Set(group.members.map((m) => m.userId));
  const resolve: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const name of parsed.members) {
    const mapped = mapping?.[name];
    const id = mapped && memberIds.has(mapped) ? mapped : byName.get(name.trim().toLowerCase());
    if (id) resolve[name] = id;
    else unmatched.push(name);
  }
  if (unmatched.length > 0) {
    return NextResponse.json(
      {
        error: `Could not match these people to group members: ${unmatched.join(', ')}`,
        unmatched,
        groupMembers: group.members.map((m) => ({ id: m.userId, name: m.user.name })),
      },
      { status: 422 },
    );
  }

  const { items, skipped } = planImport(parsed.rows);
  const expenses = items.filter((i) => i.kind === 'expense').length;
  const payments = items.length - expenses;

  if (dryRun) return NextResponse.json({ dryRun: true, expenses, payments, skipped });
  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Nothing could be imported from this file', skipped },
      { status: 400 },
    );
  }

  // Bulk insert. Doing one create per row inside an interactive transaction took ~0.8 s per row on a
  // remote database, so a few hundred rows blew the transaction timeout and rolled everything back.
  // Here the whole import is a handful of statements in one atomic batch, whatever the file size.
  const expenseRows: Prisma.ExpenseCreateManyInput[] = [];
  const splitRows: Prisma.ExpenseSplitCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  for (const item of items) {
    if (item.kind === 'payment') {
      paymentRows.push({
        payerId: resolve[item.payer],
        receiverId: resolve[item.receiver],
        amount: item.amount,
        currency: item.currency,
        groupId,
        notes: 'Imported from Splitwise',
        createdAt: item.date,
      });
    } else {
      const id = randomUUID();
      expenseRows.push({
        id,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        category: item.category,
        date: item.date,
        groupId,
        paidById: resolve[item.paidBy],
        splitType: 'custom',
        notes: 'Imported from Splitwise',
      });
      for (const sp of item.splits) {
        splitRows.push({ expenseId: id, userId: resolve[sp.name], amount: sp.amount });
      }
    }
  }

  try {
    await prisma.$transaction([
      prisma.expense.createMany({ data: expenseRows }),
      prisma.expenseSplit.createMany({ data: splitRows }),
      prisma.payment.createMany({ data: paymentRows }),
      prisma.activity.create({
        data: {
          userId: session.user.id,
          groupId,
          type: 'expense_added',
          description: `${session.user.name} imported ${expenses} expenses and ${payments} payments from Splitwise`,
        },
      }),
    ]);
  } catch (err) {
    console.error('[import]', err);
    return NextResponse.json(
      { error: 'The import failed and nothing was saved. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ imported: true, expenses, payments, skipped }, { status: 201 });
}
