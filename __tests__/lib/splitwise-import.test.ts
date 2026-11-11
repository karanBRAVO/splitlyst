import {
  mapCategory,
  parseCsv,
  parseImportDate,
  parseSplitwiseCsv,
  planImport,
} from '@/lib/splitwise-import';

const CSV = `Date,Description,Category,Cost,Currency,Alice,Bob,Carol
2024-01-05,"Dinner, with friends",Dining out,30.00,USD,20.00,-10.00,-10.00
2024-01-06,Taxi,Taxi,12.00,USD,-4.00,8.00,-4.00

2024-01-07,Settle all balances,Payment,10.00,USD,-10.00,10.00,0.00
,Total balance, ,0.00, USD,4.00,6.00,-10.00
`;

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('a,"b,c","d ""q"""\r\n1,2,3\r\n');
    expect(rows).toEqual([
      ['a', 'b,c', 'd "q"'],
      ['1', '2', '3'],
    ]);
  });
});

describe('parseSplitwiseCsv', () => {
  it('parses members and rows, skipping the total row', () => {
    const parsed = parseSplitwiseCsv(CSV);
    expect(parsed.members).toEqual(['Alice', 'Bob', 'Carol']);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0].description).toBe('Dinner, with friends');
    expect(parsed.rows[0].nets).toEqual({ Alice: 20, Bob: -10, Carol: -10 });
  });

  it('rejects unknown formats', () => {
    expect(() => parseSplitwiseCsv('foo,bar\n1,2')).toThrow(/Unrecognised/);
    expect(() => parseSplitwiseCsv('')).toThrow();
  });
});

describe('planImport', () => {
  const { rows } = parseSplitwiseCsv(CSV);
  const { items, skipped } = planImport(rows);

  it('turns a single-payer row into an expense whose splits sum to the cost', () => {
    const dinner = items[0];
    expect(dinner.kind).toBe('expense');
    if (dinner.kind !== 'expense') return;
    expect(dinner.paidBy).toBe('Alice');
    expect(dinner.category).toBe('food');
    expect(dinner.splits).toEqual([
      { name: 'Alice', amount: 10 },
      { name: 'Bob', amount: 10 },
      { name: 'Carol', amount: 10 },
    ]);
    expect(dinner.splits.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(dinner.amount, 2);
  });

  it('maps the payer row correctly when the payer is not first', () => {
    const taxi = items[1];
    if (taxi.kind !== 'expense') throw new Error('expected expense');
    expect(taxi.paidBy).toBe('Bob');
    expect(taxi.splits.find((s) => s.name === 'Bob')?.amount).toBe(4);
  });

  it('turns a settle-up row into a payment', () => {
    const pay = items[2];
    expect(pay).toMatchObject({ kind: 'payment', payer: 'Bob', receiver: 'Alice', amount: 10 });
    expect(skipped).toEqual([]);
  });

  it('skips rows with several payers or invalid dates', () => {
    const result = planImport([
      {
        date: '2024-01-01',
        description: 'Multi',
        category: '',
        cost: 10,
        currency: 'USD',
        nets: { A: 5, B: 5, C: -10 },
      },
      {
        date: 'nope',
        description: 'Bad date',
        category: '',
        cost: 10,
        currency: 'USD',
        nets: { A: 5, B: -5 },
      },
    ]);
    expect(result.items).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
  });
});

describe('mapCategory', () => {
  it('falls back sensibly', () => {
    expect(mapCategory('Dining out')).toBe('food');
    expect(mapCategory('Something odd')).toBe('other');
    expect(mapCategory('General')).toBe('general');
    expect(mapCategory('')).toBe('general');
  });
});

// A real Splitwise export: blank first row, US M/D/YY dates, trailing spaces, emoji, a
// "Payment" row in each direction, a non-"Payment" settle row and a dated "Total balance" row.
const REAL_EXPORT = `,,,,,,
Date,Description,Category,Cost,Currency,Karan 57 Yadav,mogilon504
,,,,,,
2/10/26,Lunch,Dining out,140,INR,140,-140
2/24/26,Travel,Transportation - Other,600,INR,-600,600
3/10/26,Karan Y. paid Vikas,Payment,1355,INR,1355,-1355
3/10/26,Settle all balances,General,95,INR,95,-95
3/12/26,Sandwich ,Dining out,250,INR,125,-125
9/17/26,Vikas paid Karan Y.,Payment,251.5,INR,-251.5,251.5
9/20/26,Fruits,Groceries,179,INR,-179,179
10/29/26,Furlenco,General,3782,INR,1891,-1891
7/2/26,Wifi 📶,TV/Phone/Internet,1660,INR,-830,830
,,,,,,
11/11/26,Total balance, , ,INR,4000,-4000`;

describe('parseImportDate', () => {
  it('reads US M/D/YY and M/D/YYYY (Splitwise export) as month/day', () => {
    expect(parseImportDate('2/10/26')?.toISOString().slice(0, 10)).toBe('2026-02-10');
    expect(parseImportDate('10/31/2026')?.toISOString().slice(0, 10)).toBe('2026-10-31');
    expect(parseImportDate('12/1/99')?.toISOString().slice(0, 10)).toBe('1999-12-01');
  });
  it('reads ISO dates and pins them to noon UTC so the day never shifts', () => {
    const d = parseImportDate('2024-03-05')!;
    expect(d.toISOString()).toBe('2024-03-05T12:00:00.000Z');
  });
  it('rejects impossible or unreadable dates', () => {
    expect(parseImportDate('13/40/26')).toBeNull();
    expect(parseImportDate('2/30/26')).toBeNull();
    expect(parseImportDate('yesterday')).toBeNull();
    expect(parseImportDate('')).toBeNull();
  });
});

describe('real Splitwise export', () => {
  const parsed = parseSplitwiseCsv(REAL_EXPORT);
  const { items, skipped } = planImport(parsed.rows);

  it('finds both people and ignores blank rows and the dated total row', () => {
    expect(parsed.members).toEqual(['Karan 57 Yadav', 'mogilon504']);
    expect(parsed.rows).toHaveLength(9);
    expect(parsed.rows.every((r) => !/total balance/i.test(r.description))).toBe(true);
  });

  it('imports every row (nothing skipped, no invalid dates)', () => {
    expect(skipped).toEqual([]);
    expect(items).toHaveLength(9);
  });

  it('turns "Payment" rows into payments in the right direction', () => {
    const payments = items.filter((i) => i.kind === 'payment');
    expect(payments).toHaveLength(3);
    expect(payments[0]).toMatchObject({
      payer: 'Karan 57 Yadav',
      receiver: 'mogilon504',
      amount: 1355,
    });
    // the reverse direction: the other person paid
    expect(payments[2]).toMatchObject({
      payer: 'mogilon504',
      receiver: 'Karan 57 Yadav',
      amount: 251.5,
    });
  });

  it('treats "Settle all balances" as a payment even when its category is General', () => {
    const settle = items.find((i) => i.kind === 'payment' && i.amount === 95);
    expect(settle).toMatchObject({ payer: 'Karan 57 Yadav', receiver: 'mogilon504' });
    expect(items.some((i) => i.kind === 'expense' && i.description === 'Settle all balances')).toBe(
      false,
    );
  });

  it('handles equal splits, trimmed names, and the other person paying', () => {
    const sandwich = items.find((i) => i.kind === 'expense' && i.description === 'Sandwich');
    expect(sandwich).toMatchObject({ amount: 250, paidBy: 'Karan 57 Yadav' });
    if (sandwich?.kind === 'expense') {
      expect(sandwich.splits).toEqual([
        { name: 'Karan 57 Yadav', amount: 125 },
        { name: 'mogilon504', amount: 125 },
      ]);
    }
    const fruits = items.find((i) => i.kind === 'expense' && i.description === 'Fruits');
    expect(fruits).toMatchObject({ paidBy: 'mogilon504' });
    if (fruits?.kind === 'expense') {
      // payer has net +179 on a 179 cost => payer's own share is 0, the other owes it all
      expect(fruits.splits).toEqual([{ name: 'Karan 57 Yadav', amount: 179 }]);
    }
  });

  it('reads the dates as 2026 month/day', () => {
    const lunch = items.find((i) => i.kind === 'expense' && i.description === 'Lunch');
    expect(lunch?.date.toISOString().slice(0, 10)).toBe('2026-02-10');
  });
});

describe('mapCategory (keywords)', () => {
  it.each([
    ['Dining out', 'food'],
    ['Groceries', 'groceries'],
    ['Transportation - Other', 'transport'],
    ['Gas/fuel', 'transport'],
    ['Heat/gas', 'utilities'],
    ['TV/Phone/Internet', 'utilities'],
    ['Utilities - Other', 'utilities'],
    ['Electricity', 'utilities'],
    ['Rent', 'rent'],
    ['Gifts', 'gifts'],
    ['Clothing', 'shopping'],
    ['Liquor', 'food'],
    ['Cleaning', 'other'],
    ['General', 'general'],
    ['', 'general'],
  ])('%s -> %s', (input, expected) => {
    expect(mapCategory(input)).toBe(expected);
  });
});
