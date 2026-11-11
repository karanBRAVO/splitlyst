// Pure helpers for presenting the activity feed (shared by the page and unit tests).

export type ActivityMeta = {
  description?: string;
  amount?: number;
  currency?: string;
  payerId?: string;
  payerName?: string;
  receiverId?: string;
  receiverName?: string;
};

export type ActivityEntry = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  metadata?: ActivityMeta | null;
  user: { id: string; name: string; avatar: string | null };
  group?: { id: string; name: string } | null;
  expense?: { id: string; description: string; amount: number; currency: string } | null;
  /** Your personal effect of this activity, computed on the server */
  impact?: {
    kind: 'lent' | 'borrowed' | 'paid' | 'received';
    amount: number;
    currency: string;
  } | null;
};

export type ActivityCategory = 'all' | 'expenses' | 'payments' | 'groups';

export function categoryOf(type: string): Exclude<ActivityCategory, 'all'> {
  if (type.startsWith('expense_')) return 'expenses';
  if (type.startsWith('payment_') || type === 'settled_up') return 'payments';
  return 'groups';
}

/**
 * A readable one-line sentence split into parts so the UI can bold names/amounts:
 * actor ("You" for the viewer), verb phrase, and the thing acted on.
 */
export function headline(
  a: ActivityEntry,
  viewerId?: string,
): {
  actor: string;
  verb: string;
  subject: string | null;
  amount: { value: number; currency: string } | null;
} {
  const you = a.user.id === viewerId;
  const actor = you ? 'You' : a.user.name;
  const m = a.metadata ?? {};
  const subject = a.expense?.description ?? m.description ?? null;
  const amount =
    typeof m.amount === 'number' && m.currency ? { value: m.amount, currency: m.currency } : null;

  switch (a.type) {
    case 'expense_added':
      return { actor, verb: 'added', subject, amount };
    case 'expense_updated':
      return { actor, verb: 'updated', subject, amount };
    case 'expense_deleted':
      return { actor, verb: 'deleted', subject, amount };
    case 'payment_recorded': {
      const payer = m.payerId === viewerId ? 'You' : (m.payerName ?? a.user.name);
      const receiver = m.receiverId === viewerId ? 'you' : (m.receiverName ?? 'someone');
      return { actor: payer, verb: `paid ${receiver}`, subject: null, amount };
    }
    case 'group_created':
      return { actor, verb: 'created the group', subject: a.group?.name ?? null, amount: null };
    case 'member_added':
      return {
        actor,
        verb: 'changed the members of',
        subject: a.group?.name ?? null,
        amount: null,
      };
    default:
      return {
        actor,
        verb: a.description.replace(a.user.name, '').trim(),
        subject: null,
        amount: null,
      };
  }
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', {
    weekday: diffDays < 7 ? 'long' : undefined,
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

export function groupByDay<T extends { createdAt: string }>(
  items: T[],
  now = new Date(),
): Array<{ label: string; items: T[] }> {
  const groups: Array<{ label: string; items: T[] }> = [];
  for (const item of items) {
    const label = dayLabel(item.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
