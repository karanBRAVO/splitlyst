'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Receipt, Search, Plus, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { formatCurrency, formatDate, getCategoryEmoji } from '@/lib/utils';
import { EXPENSE_CATEGORIES } from '@/types';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export default function ExpensesPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, category],
    queryFn: () => fetch(`/api/expenses?${params}`).then((r) => r.json()),
  });

  const expenses = data?.expenses || [];

  return (
    <div>
      <Header title="Expenses" />
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title hidden lg:block">Expenses</h1>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'btn btn-secondary btn-md gap-2',
                showFilters && 'border-brand-300 bg-brand-50 text-brand-700',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <Link href="/expenses/new" className="btn btn-primary btn-md gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="input pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="card mb-4 p-4">
            <div className="mb-3 text-xs font-medium text-gray-500">Category</div>
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
                  className={cn(
                    'btn btn-sm gap-1.5',
                    category === cat.value ? 'btn-primary' : 'btn-secondary',
                  )}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="mb-4 flex justify-end">
          <a
            href="/api/export?type=csv"
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
          >
            Export CSV
          </a>
        </div>

        {isLoading ? (
          <SkeletonList count={5} />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title={search || category ? 'No expenses found' : 'No expenses yet'}
            description={
              search || category ? 'Try different filters' : 'Add your first expense to get started'
            }
            action={
              !search &&
              !category && (
                <Link href="/expenses/new" className="btn btn-primary btn-md">
                  Add expense
                </Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {expenses.map(
              (expense: {
                id: string;
                description: string;
                amount: number;
                currency: string;
                category: string;
                date: string;
                paidById: string;
                paidBy?: { id: string; name: string; avatar: string | null };
                group?: { id: string; name: string } | null;
                splits?: Array<{ userId: string; amount: number }>;
              }) => {
                const userSplit = expense.splits?.find(
                  (s: { userId: string; amount: number }) => s.userId === session?.user?.id,
                );
                const isMyExpense = expense.paidById === session?.user?.id;

                return (
                  <Link key={expense.id} href={`/expenses/${expense.id}`}>
                    <div className="card cursor-pointer p-4 transition-colors hover:border-brand-300">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                          {getCategoryEmoji(expense.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium text-gray-900">
                              {expense.description}
                            </span>
                            {expense.group && (
                              <span className="badge badge-gray shrink-0 text-[10px]">
                                {expense.group.name}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Avatar
                              src={expense.paidBy?.avatar}
                              name={expense.paidBy?.name || '?'}
                              size="xs"
                            />
                            <span className="text-xs text-gray-500">
                              {isMyExpense ? 'You' : expense.paidBy?.name} ·{' '}
                              {formatDate(expense.date)}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(expense.amount, expense.currency)}
                          </div>
                          {userSplit && (
                            <div
                              className={cn(
                                'text-xs font-medium',
                                isMyExpense ? 'text-brand-600' : 'text-red-500',
                              )}
                            >
                              {isMyExpense
                                ? `you paid`
                                : `you owe ${formatCurrency(userSplit.amount, expense.currency)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
