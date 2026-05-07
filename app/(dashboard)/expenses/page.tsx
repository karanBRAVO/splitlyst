'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Receipt, Search, Filter, Plus, SlidersHorizontal } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonList } from '@/components/ui/loading'
import { formatCurrency, formatDate, getCategoryEmoji } from '@/lib/utils'
import { EXPENSE_CATEGORIES } from '@/types'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'

export default function ExpensesPage() {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (category) params.set('category', category)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, category],
    queryFn: () => fetch(`/api/expenses?${params}`).then((r) => r.json()),
  })

  const expenses = data?.expenses || []

  return (
    <div>
      <Header title="Expenses" />
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title hidden lg:block">Expenses</h1>
          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn('btn btn-secondary btn-md gap-2', showFilters && 'bg-brand-50 border-brand-300 text-brand-700')}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <Link href="/expenses/new" className="btn btn-primary btn-md gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="input pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-4 p-4 card">
            <div className="text-xs font-medium text-gray-500 mb-3">Category</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategory('')}
                className={cn('btn btn-sm', !category ? 'btn-primary' : 'btn-secondary')}
              >
                All
              </button>
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value === category ? '' : cat.value)}
                  className={cn('btn btn-sm gap-1.5', category === cat.value ? 'btn-primary' : 'btn-secondary')}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="flex justify-end mb-4">
          <a
            href="/api/export?type=csv"
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Export CSV
          </a>
        </div>

        {isLoading ? (
          <SkeletonList count={5} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-8 h-8" />}
            title={search || category ? 'No expenses found' : 'No expenses yet'}
            description={search || category ? 'Try different filters' : 'Add your first expense to get started'}
            action={
              !search && !category && (
                <Link href="/expenses/new" className="btn btn-primary btn-md">
                  Add expense
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {expenses.map((expense: any) => {
              const userSplit = expense.splits?.find((s: any) => s.userId === session?.user?.id)
              const isMyExpense = expense.paidById === session?.user?.id

              return (
                <Link key={expense.id} href={`/expenses/${expense.id}`}>
                  <div className="card p-4 hover:border-brand-300 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
                        {getCategoryEmoji(expense.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{expense.description}</span>
                          {expense.group && (
                            <span className="badge badge-gray text-[10px] shrink-0">{expense.group.name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Avatar src={expense.paidBy?.avatar} name={expense.paidBy?.name || '?'} size="xs" />
                          <span className="text-xs text-gray-500">
                            {isMyExpense ? 'You' : expense.paidBy?.name} · {formatDate(expense.date)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(expense.amount, expense.currency)}
                        </div>
                        {userSplit && (
                          <div className={cn(
                            'text-xs font-medium',
                            isMyExpense ? 'text-brand-600' : 'text-red-500'
                          )}>
                            {isMyExpense
                              ? `you paid`
                              : `you owe ${formatCurrency(userSplit.amount, expense.currency)}`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
