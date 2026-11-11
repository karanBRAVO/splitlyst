import { categoryOf, dayLabel, groupByDay, headline, type ActivityEntry } from '@/lib/activity';

const base: ActivityEntry = {
  id: '1',
  type: 'expense_added',
  description: 'Alice added "Dinner" ($60.00)',
  createdAt: '2024-05-10T12:00:00Z',
  user: { id: 'alice', name: 'Alice', avatar: null },
  metadata: { description: 'Dinner', amount: 60, currency: 'USD' },
};

describe('headline', () => {
  it('says "You" for the viewer and the name for others', () => {
    expect(headline(base, 'alice').actor).toBe('You');
    expect(headline(base, 'bob').actor).toBe('Alice');
  });

  it('describes expenses with subject and amount', () => {
    const h = headline(base, 'bob');
    expect(h).toMatchObject({
      verb: 'added',
      subject: 'Dinner',
      amount: { value: 60, currency: 'USD' },
    });
  });

  it('still names an expense that was deleted (from stored metadata)', () => {
    const h = headline({ ...base, type: 'expense_deleted', expense: null }, 'bob');
    expect(h).toMatchObject({ verb: 'deleted', subject: 'Dinner' });
  });

  it('describes payments from the viewer’s point of view', () => {
    const pay: ActivityEntry = {
      ...base,
      type: 'payment_recorded',
      metadata: {
        amount: 20,
        currency: 'EUR',
        payerId: 'bob',
        payerName: 'Bob',
        receiverId: 'alice',
        receiverName: 'Alice',
      },
    };
    expect(headline(pay, 'alice')).toMatchObject({ actor: 'Bob', verb: 'paid you' });
    expect(headline(pay, 'bob')).toMatchObject({ actor: 'You', verb: 'paid Alice' });
    expect(headline(pay, 'carol')).toMatchObject({ actor: 'Bob', verb: 'paid Alice' });
  });
});

describe('categoryOf', () => {
  it('buckets activity types', () => {
    expect(categoryOf('expense_updated')).toBe('expenses');
    expect(categoryOf('payment_recorded')).toBe('payments');
    expect(categoryOf('group_created')).toBe('groups');
    expect(categoryOf('member_added')).toBe('groups');
  });
});

describe('day grouping', () => {
  const now = new Date('2024-05-10T15:00:00');
  it('labels today and yesterday', () => {
    expect(dayLabel('2024-05-10T01:00:00', now)).toBe('Today');
    expect(dayLabel('2024-05-09T23:00:00', now)).toBe('Yesterday');
  });
  it('labels older dates', () => {
    expect(dayLabel('2024-05-05T10:00:00', now)).toMatch(/Sunday/);
    expect(dayLabel('2024-01-02T10:00:00', now)).toMatch(/Jan 2/);
    expect(dayLabel('2023-01-02T10:00:00', now)).toMatch(/2023/);
  });
  it('groups consecutive items by day, newest first', () => {
    const groups = groupByDay(
      [
        { createdAt: '2024-05-10T10:00:00' },
        { createdAt: '2024-05-10T09:00:00' },
        { createdAt: '2024-05-09T09:00:00' },
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
    ]);
  });
});
