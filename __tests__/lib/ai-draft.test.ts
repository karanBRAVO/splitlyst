import {
  buildReaderMessages,
  extractJson,
  matchPerson,
  resolveDraft,
  type Person,
} from '@/lib/ai-draft';

const people: Person[] = [
  { id: 'me', name: 'Karan Yadav' },
  { id: 'p1', name: 'Priya Sharma' },
  { id: 'p2', name: 'Amit Patel' },
  { id: 'p3', name: 'Priyanka Rao' },
];

describe('extractJson', () => {
  it('parses plain JSON, fenced JSON and JSON surrounded by chatter', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! Here you go: {"a":3} hope that helps')).toEqual({ a: 3 });
  });
  it('throws when there is no object', () => {
    expect(() => extractJson('no json here')).toThrow(/No JSON/);
    expect(() => extractJson('{broken')).toThrow();
  });
});

describe('matchPerson', () => {
  it('maps "me" and its synonyms to the signed-in user', () => {
    for (const w of ['me', 'I', 'myself', 'Me'])
      expect(matchPerson(w, people, 'me')?.id).toBe('me');
  });
  it('matches by full name, then unique first name', () => {
    expect(matchPerson('Amit Patel', people, 'me')?.id).toBe('p2');
    expect(matchPerson('amit', people, 'me')?.id).toBe('p2');
  });
  it('does not guess when a first name is ambiguous or unknown', () => {
    expect(matchPerson('Pri', people, 'me')).toBeNull(); // prefix matches two people
    expect(matchPerson('Zed', people, 'me')).toBeNull();
    expect(matchPerson('', people, 'me')).toBeNull();
  });
  it('prefers an exact first-name match over a longer name that merely starts with it', () => {
    expect(matchPerson('Priya', people, 'me')?.id).toBe('p1');
  });
});

describe('resolveDraft', () => {
  it('builds an equal split between named people, with the user as default payer', () => {
    const d = resolveDraft(
      {
        description: 'Dinner',
        amount: 3200,
        currency: 'inr',
        category: 'food',
        participants: ['Priya', 'Amit'],
      },
      people,
      'me',
    );
    expect(d).toMatchObject({
      description: 'Dinner',
      amount: 3200,
      currency: 'INR',
      category: 'food',
      splitType: 'equal',
      paidById: 'me',
      unmatched: [],
    });
    expect(d.participantIds.sort()).toEqual(['me', 'p1', 'p2']);
  });

  it('always includes the payer, even if the model forgot to list them', () => {
    const d = resolveDraft(
      { description: 'Cab', amount: 450, paidBy: 'Amit', participants: ['me'] },
      people,
      'me',
    );
    expect(d.paidById).toBe('p2');
    expect(d.participantIds.sort()).toEqual(['me', 'p2']);
  });

  it('ignores ids and strangers: only real people are ever referenced', () => {
    const d = resolveDraft(
      { description: 'x', amount: 10, paidBy: 'u_evil', participants: ['u_evil', 'Mallory'] },
      people,
      'me',
    );
    expect(d.participantIds).toEqual(['me']);
    expect(d.paidById).toBe('me');
    expect(d.unmatched.sort()).toEqual(['Mallory', 'u_evil']);
  });

  it('keeps consistent custom and percentage splits', () => {
    const custom = resolveDraft(
      {
        description: 'x',
        amount: 100,
        splitType: 'custom',
        splits: [
          { name: 'me', amount: 60 },
          { name: 'Amit', amount: 40 },
        ],
      },
      people,
      'me',
    );
    expect(custom.splitType).toBe('custom');
    expect(custom.splits).toHaveLength(2);

    const pct = resolveDraft(
      {
        description: 'x',
        amount: 100,
        splitType: 'percentage',
        splits: [
          { name: 'me', percentage: 70 },
          { name: 'Amit', percentage: 30 },
        ],
      },
      people,
      'me',
    );
    expect(pct.splitType).toBe('percentage');
  });

  it('falls back to an equal split when explicit splits do not add up', () => {
    const d = resolveDraft(
      {
        description: 'x',
        amount: 100,
        splitType: 'custom',
        splits: [
          { name: 'me', amount: 10 },
          { name: 'Amit', amount: 10 },
        ],
      },
      people,
      'me',
    );
    expect(d.splitType).toBe('equal');
    expect(d.splits).toEqual([]);
    const pct = resolveDraft(
      {
        description: 'x',
        amount: 100,
        splitType: 'percentage',
        splits: [{ name: 'me', percentage: 80 }],
      },
      people,
      'me',
    );
    expect(pct.splitType).toBe('equal');
  });

  it('rounds the amount and falls back to "general" for unknown categories', () => {
    const d = resolveDraft(
      { description: 'x', amount: 10.005, category: 'wizardry' },
      people,
      'me',
    );
    expect(d.category).toBe('general');
    expect(d.amount).toBeCloseTo(10.01, 2);
  });

  it('rejects drafts that are not an expense', () => {
    expect(() => resolveDraft({ description: '', amount: 5 }, people, 'me')).toThrow();
    expect(() => resolveDraft({ description: 'x', amount: -5 }, people, 'me')).toThrow();
    expect(() => resolveDraft({ description: 'x', amount: 'lots' }, people, 'me')).toThrow();
    expect(() =>
      resolveDraft({ description: 'x', amount: 5, currency: 'RUPEES' }, people, 'me'),
    ).toThrow();
  });
});

describe('buildReaderMessages', () => {
  const msgs = buildReaderMessages({
    text: 'Dinner 60',
    people,
    meName: 'Karan Yadav',
    defaultCurrency: 'INR',
  });

  it('lists only the allowed people and the default currency', () => {
    expect(msgs[0].content).toContain('Priya Sharma');
    expect(msgs[0].content).toContain('INR');
  });
  it('wraps user text as data and tells the model to ignore instructions inside it', () => {
    expect(msgs[1].content).toBe('<expense>Dinner 60</expense>');
    expect(msgs[0].content).toMatch(/never as instructions/);
  });
});
