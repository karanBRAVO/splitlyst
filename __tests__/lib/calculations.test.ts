import {
  calculateEqualSplits,
  calculatePercentageSplits,
  calculateSharesSplits,
  validateCustomSplits,
  simplifyDebts,
  calculateGroupBalances,
  getTotalBalance,
} from '@/lib/calculations'

describe('calculateEqualSplits', () => {
  it('splits evenly among two people', () => {
    const result = calculateEqualSplits(20, ['a', 'b'])
    expect(result).toHaveLength(2)
    const total = result.reduce((s, r) => s + (r.amount ?? 0), 0)
    expect(total).toBeCloseTo(20, 2)
  })

  it('adds remainder to the first participant', () => {
    // $10 / 3 = $3.33 + $3.33 + $3.34; first gets the extra cent
    const result = calculateEqualSplits(10, ['a', 'b', 'c'])
    expect(result[0].amount).toBeCloseTo(3.34, 2)
    expect(result[1].amount).toBeCloseTo(3.33, 2)
    expect(result[2].amount).toBeCloseTo(3.33, 2)
  })

  it('returns empty array for no participants', () => {
    expect(calculateEqualSplits(100, [])).toEqual([])
  })

  it('assigns the full amount to a single participant', () => {
    const result = calculateEqualSplits(99.99, ['only'])
    expect(result[0].amount).toBeCloseTo(99.99, 2)
  })
})

describe('calculatePercentageSplits', () => {
  it('splits correctly by percentage', () => {
    const result = calculatePercentageSplits(200, [
      { userId: 'a', percentage: 50 },
      { userId: 'b', percentage: 30 },
      { userId: 'c', percentage: 20 },
    ])
    expect(result.find((r) => r.userId === 'a')?.amount).toBeCloseTo(100, 2)
    expect(result.find((r) => r.userId === 'b')?.amount).toBeCloseTo(60, 2)
    expect(result.find((r) => r.userId === 'c')?.amount).toBeCloseTo(40, 2)
  })

  it('throws when percentages do not sum to 100', () => {
    expect(() =>
      calculatePercentageSplits(100, [
        { userId: 'a', percentage: 40 },
        { userId: 'b', percentage: 40 },
      ])
    ).toThrow('Percentages must sum to 100')
  })
})

describe('calculateSharesSplits', () => {
  it('splits proportionally by shares', () => {
    const result = calculateSharesSplits(90, [
      { userId: 'a', shares: 2 },
      { userId: 'b', shares: 1 },
    ])
    expect(result.find((r) => r.userId === 'a')?.amount).toBeCloseTo(60, 2)
    expect(result.find((r) => r.userId === 'b')?.amount).toBeCloseTo(30, 2)
  })

  it('treats zero shares as 1 (equal split fallback)', () => {
    // shares: 0 falls back to 1 via `|| 1`, so both get an equal split
    const result = calculateSharesSplits(100, [
      { userId: 'a', shares: 0 },
      { userId: 'b', shares: 0 },
    ])
    expect(result.find((r) => r.userId === 'a')?.amount).toBeCloseTo(50, 2)
    expect(result.find((r) => r.userId === 'b')?.amount).toBeCloseTo(50, 2)
  })
})

describe('validateCustomSplits', () => {
  it('returns true when amounts sum to total', () => {
    expect(
      validateCustomSplits(100, [
        { userId: 'a', amount: 60 },
        { userId: 'b', amount: 40 },
      ])
    ).toBe(true)
  })

  it('returns true within $0.02 tolerance', () => {
    expect(
      validateCustomSplits(100, [
        { userId: 'a', amount: 66.67 },
        { userId: 'b', amount: 33.32 },
      ])
    ).toBe(true)
  })

  it('returns false when amounts differ by more than $0.02', () => {
    expect(
      validateCustomSplits(100, [
        { userId: 'a', amount: 50 },
        { userId: 'b', amount: 40 },
      ])
    ).toBe(false)
  })
})

describe('simplifyDebts', () => {
  it('returns empty array for no balances', () => {
    expect(simplifyDebts([])).toEqual([])
  })

  it('produces at most n-1 transactions for n people', () => {
    const result = simplifyDebts([
      { owedByUserId: 'b', owesToUserId: 'a', amount: 30 },
      { owedByUserId: 'c', owesToUserId: 'a', amount: 20 },
      { owedByUserId: 'c', owesToUserId: 'b', amount: 10 },
    ])
    expect(result.length).toBeLessThanOrEqual(2) // 3 people → at most 2 transactions
  })

  it('correctly net-settles circular debts', () => {
    // A→B $10, B→C $10, C→A $10 — all cancel out
    const result = simplifyDebts([
      { owedByUserId: 'a', owesToUserId: 'b', amount: 10 },
      { owedByUserId: 'b', owesToUserId: 'c', amount: 10 },
      { owedByUserId: 'c', owesToUserId: 'a', amount: 10 },
    ])
    expect(result).toHaveLength(0)
  })

  it('preserves net position of each person after simplification', () => {
    // b owes a $50, c owes a $30, d owes b $20
    // Net: a=+80, b=-30, c=-30, d=-20
    // Simplification may reduce total transfer amount (that's the point),
    // but each person's net balance must be unchanged.
    const input = [
      { owedByUserId: 'b', owesToUserId: 'a', amount: 50 },
      { owedByUserId: 'c', owesToUserId: 'a', amount: 30 },
      { owedByUserId: 'd', owesToUserId: 'b', amount: 20 },
    ]
    const result = simplifyDebts(input)

    const net = (id: string) => {
      let n = 0
      for (const r of result) {
        if (r.owesToUserId === id) n += r.amount
        if (r.owedByUserId === id) n -= r.amount
      }
      return n
    }

    expect(net('a')).toBeCloseTo(80, 2)
    expect(net('b')).toBeCloseTo(-30, 2)
    expect(net('c')).toBeCloseTo(-30, 2)
    expect(net('d')).toBeCloseTo(-20, 2)
  })
})

describe('calculateGroupBalances', () => {
  const expenses = [
    {
      paidById: 'alice',
      splits: [
        { userId: 'alice', amount: 50 },
        { userId: 'bob', amount: 50 },
      ],
    },
  ]

  it('records that bob owes alice after alice pays', () => {
    const net = calculateGroupBalances(expenses, [])
    expect(net['alice']['bob']).toBeCloseTo(50, 2)
    expect(net['bob']['alice']).toBeCloseTo(-50, 2)
  })

  it('reduces the debt after a payment', () => {
    const net = calculateGroupBalances(expenses, [
      { payerId: 'bob', receiverId: 'alice', amount: 30 },
    ])
    expect(net['alice']['bob']).toBeCloseTo(20, 2)
  })

  it('clears the debt after a full payment', () => {
    const net = calculateGroupBalances(expenses, [
      { payerId: 'bob', receiverId: 'alice', amount: 50 },
    ])
    expect(net['alice']['bob']).toBeCloseTo(0, 2)
  })
})

describe('getTotalBalance', () => {
  it('computes owed, owes, and net correctly', () => {
    const expenses = [
      {
        paidById: 'alice',
        splits: [
          { userId: 'alice', amount: 40 },
          { userId: 'bob', amount: 60 },
        ],
      },
    ]
    const { owed, owes, net } = getTotalBalance(expenses, [], 'alice')
    expect(owed).toBeCloseTo(60, 2)
    expect(owes).toBeCloseTo(0, 2)
    expect(net).toBeCloseTo(60, 2)
  })
})
