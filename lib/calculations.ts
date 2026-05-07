import { roundToTwoDecimals } from './utils'

export interface SplitParticipant {
  userId: string
  amount?: number
  percentage?: number
  shares?: number
}

export function calculateEqualSplits(
  total: number,
  participants: string[]
): SplitParticipant[] {
  const count = participants.length
  if (count === 0) return []
  const base = Math.floor((total / count) * 100) / 100
  const remainder = roundToTwoDecimals(total - base * count)

  return participants.map((userId, i) => ({
    userId,
    amount: roundToTwoDecimals(base + (i === 0 ? remainder : 0)),
  }))
}

export function calculatePercentageSplits(
  total: number,
  participants: SplitParticipant[]
): SplitParticipant[] {
  const totalPct = participants.reduce((s, p) => s + (p.percentage || 0), 0)
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error('Percentages must sum to 100')
  }
  return participants.map((p) => ({
    ...p,
    amount: roundToTwoDecimals(total * ((p.percentage || 0) / 100)),
  }))
}

export function calculateSharesSplits(
  total: number,
  participants: SplitParticipant[]
): SplitParticipant[] {
  const totalShares = participants.reduce((s, p) => s + (p.shares || 1), 0)
  if (totalShares === 0) return participants.map((p) => ({ ...p, amount: 0 }))
  return participants.map((p) => ({
    ...p,
    amount: roundToTwoDecimals(total * ((p.shares || 1) / totalShares)),
  }))
}

export function validateCustomSplits(
  total: number,
  participants: SplitParticipant[]
): boolean {
  const sum = participants.reduce((s, p) => s + (p.amount || 0), 0)
  return Math.abs(sum - total) < 0.02
}

export interface RawBalance {
  owesToUserId: string
  owedByUserId: string
  amount: number
}

export function simplifyDebts(balances: RawBalance[]): RawBalance[] {
  const net: Record<string, number> = {}

  for (const b of balances) {
    net[b.owedByUserId] = (net[b.owedByUserId] || 0) - b.amount
    net[b.owesToUserId] = (net[b.owesToUserId] || 0) + b.amount
  }

  const creditors: Array<{ id: string; amount: number }> = []
  const debtors: Array<{ id: string; amount: number }> = []

  for (const [id, amount] of Object.entries(net)) {
    if (amount > 0.01) creditors.push({ id, amount })
    else if (amount < -0.01) debtors.push({ id, amount: -amount })
  }

  const result: RawBalance[] = []

  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]
    const debtor = debtors[di]
    const settle = Math.min(creditor.amount, debtor.amount)

    result.push({
      owedByUserId: debtor.id,
      owesToUserId: creditor.id,
      amount: roundToTwoDecimals(settle),
    })

    creditor.amount -= settle
    debtor.amount -= settle

    if (creditor.amount < 0.01) ci++
    if (debtor.amount < 0.01) di++
  }

  return result
}

export function calculateGroupBalances(
  expenses: Array<{
    paidById: string
    splits: Array<{ userId: string; amount: number }>
  }>,
  payments: Array<{ payerId: string; receiverId: string; amount: number }>
): Record<string, Record<string, number>> {
  // net[A][B] = positive means B owes A, negative means A owes B
  const net: Record<string, Record<string, number>> = {}

  const ensure = (a: string, b: string) => {
    if (!net[a]) net[a] = {}
    if (!net[b]) net[b] = {}
    if (net[a][b] === undefined) net[a][b] = 0
    if (net[b][a] === undefined) net[b][a] = 0
  }

  for (const expense of expenses) {
    const payer = expense.paidById
    for (const split of expense.splits) {
      if (split.userId === payer) continue
      ensure(payer, split.userId)
      net[payer][split.userId] += split.amount
      net[split.userId][payer] -= split.amount
    }
  }

  for (const payment of payments) {
    ensure(payment.payerId, payment.receiverId)
    net[payment.receiverId][payment.payerId] -= payment.amount
    net[payment.payerId][payment.receiverId] += payment.amount
  }

  return net
}

export function getTotalBalance(
  expenses: Array<{
    paidById: string
    splits: Array<{ userId: string; amount: number }>
  }>,
  payments: Array<{ payerId: string; receiverId: string; amount: number }>,
  userId: string
): { owed: number; owes: number; net: number } {
  const net = calculateGroupBalances(expenses, payments)
  const userBalances = net[userId] || {}

  let owed = 0
  let owes = 0

  for (const [, amount] of Object.entries(userBalances)) {
    if (amount > 0) owed += amount
    else owes += Math.abs(amount)
  }

  return {
    owed: roundToTwoDecimals(owed),
    owes: roundToTwoDecimals(owes),
    net: roundToTwoDecimals(owed - owes),
  }
}
