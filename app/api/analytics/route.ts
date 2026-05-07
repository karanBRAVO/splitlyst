import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getAuth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') || '6')

  const startDate = startOfMonth(subMonths(new Date(), months - 1))
  const endDate = endOfMonth(new Date())

  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      OR: [
        { paidById: session.user.id },
        { splits: { some: { userId: session.user.id } } },
      ],
    },
    include: {
      splits: { where: { userId: session.user.id } },
    },
  })

  // Per-month totals
  const monthlyData: Record<string, { month: string; total: number; paid: number; owed: number }> = {}
  for (let i = 0; i < months; i++) {
    const d = subMonths(new Date(), months - 1 - i)
    const key = format(d, 'yyyy-MM')
    monthlyData[key] = { month: format(d, 'MMM yyyy'), total: 0, paid: 0, owed: 0 }
  }

  for (const expense of expenses) {
    const key = format(new Date(expense.date), 'yyyy-MM')
    if (!monthlyData[key]) continue
    const userSplit = expense.splits[0]
    const amount = userSplit?.amount || 0
    monthlyData[key].total += amount
    if (expense.paidById === session.user.id) {
      monthlyData[key].paid += expense.amount
    } else {
      monthlyData[key].owed += amount
    }
  }

  // Category breakdown
  const categoryMap: Record<string, number> = {}
  for (const expense of expenses) {
    const userSplit = expense.splits[0]
    const amount = userSplit?.amount || 0
    categoryMap[expense.category] = (categoryMap[expense.category] || 0) + amount
  }
  const categoryData = Object.entries(categoryMap)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)

  // Top expenses
  const topExpenses = expenses
    .map((e) => ({ ...e, userAmount: e.splits[0]?.amount || 0 }))
    .sort((a, b) => b.userAmount - a.userAmount)
    .slice(0, 5)

  const monthlyArray = Object.values(monthlyData).map((m) => ({
    ...m,
    total: Math.round(m.total * 100) / 100,
    paid: Math.round(m.paid * 100) / 100,
    owed: Math.round(m.owed * 100) / 100,
  }))

  const totalSpent = monthlyArray.reduce((s, m) => s + m.total, 0)
  const avgMonthly = Math.round((totalSpent / months) * 100) / 100

  return NextResponse.json({
    monthlyData: monthlyArray,
    categoryData,
    topExpenses: topExpenses.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.userAmount,
      category: e.category,
      date: e.date,
    })),
    summary: {
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgMonthly,
      totalExpenses: expenses.length,
      topCategory: categoryData[0]?.category || 'general',
    },
  })
}
