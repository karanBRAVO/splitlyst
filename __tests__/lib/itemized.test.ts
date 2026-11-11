import { calculateItemizedSplits } from '@/lib/calculations';

const sum = (r: Array<{ amount?: number }>) =>
  Math.round(r.reduce((s, x) => s + (x.amount ?? 0), 0) * 100) / 100;

describe('calculateItemizedSplits', () => {
  it('splits shared items equally and personal items fully', () => {
    const r = calculateItemizedSplits([
      { amount: 20, assignedTo: ['a'] },
      { amount: 10, assignedTo: ['a', 'b'] },
    ]);
    expect(r.find((x) => x.userId === 'a')?.amount).toBe(25);
    expect(r.find((x) => x.userId === 'b')?.amount).toBe(5);
  });

  it('shares tax and tip in proportion to each person’s subtotal', () => {
    const r = calculateItemizedSplits(
      [
        { amount: 30, assignedTo: ['a'] },
        { amount: 10, assignedTo: ['b'] },
      ],
      4,
      8,
    );
    // 12 extras split 75% / 25%
    expect(r.find((x) => x.userId === 'a')?.amount).toBe(39);
    expect(r.find((x) => x.userId === 'b')?.amount).toBe(13);
    expect(sum(r)).toBe(52);
  });

  it('always adds up to items + tax + tip despite rounding', () => {
    const r = calculateItemizedSplits(
      [
        { amount: 10, assignedTo: ['a', 'b', 'c'] },
        { amount: 7.77, assignedTo: ['a', 'c'] },
      ],
      1.11,
      2.22,
    );
    expect(sum(r)).toBe(21.1);
  });

  it('returns nothing without assigned items', () => {
    expect(calculateItemizedSplits([])).toEqual([]);
    expect(calculateItemizedSplits([{ amount: 5, assignedTo: [] }])).toEqual([]);
  });
});
