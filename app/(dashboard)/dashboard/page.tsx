'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  TrendingUp,
  TrendingDown,
  Users,
  PlusCircle,
  ArrowRight,
  Receipt,
  CreditCard,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { SkeletonList } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatDateRelative, getCategoryEmoji } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { data: session } = useSession()
  const user = session?.user

  const { data: balanceData, isLoading: balancesLoading } = useQuery({
    queryKey: ['balances'],
    queryFn: () => fetch('/api/balances').then((r) => r.json()),
  })

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=10').then((r) => r.json()),
  })

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => fetch('/api/groups').then((r) => r.json()),
  })

  const balances = balanceData?.balances || []
  const totalOwed = balanceData?.totalOwed || 0
  const totalOwes = balanceData?.totalOwes || 0
  const net = balanceData?.net || 0
  const activities = activityData || []
  const groups = groupsData || []

  return (
    <div>
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Hi, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here&apos;s your expense summary</p>
        </div>

        {/* Balance Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-500">Total owed to you</div>
              <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-brand-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-brand-600">
              {formatCurrency(totalOwed, user?.currency)}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-500">You owe others</div>
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(totalOwes, user?.currency)}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-500">Net balance</div>
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                net >= 0 ? 'bg-brand-50' : 'bg-red-50'
              )}>
                <CreditCard className={cn('w-4 h-4', net >= 0 ? 'text-brand-600' : 'text-red-500')} />
              </div>
            </div>
            <div className={cn('text-2xl font-bold', net >= 0 ? 'text-brand-600' : 'text-red-500')}>
              {net >= 0 ? '+' : ''}{formatCurrency(net, user?.currency)}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link href="/expenses/new" className="card p-4 flex flex-col items-center gap-2 hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-center">
            <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-700">Add Expense</span>
          </Link>
          <Link href="/groups/new" className="card p-4 flex flex-col items-center gap-2 hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">New Group</span>
          </Link>
          <Link href="/expenses" className="card p-4 flex flex-col items-center gap-2 hover:border-brand-300 hover:bg-brand-50/30 transition-colors text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">All Expenses</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Balances */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Balances</h2>
              <Link href="/friends" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4">
              {balancesLoading ? (
                <SkeletonList count={3} />
              ) : balances.length === 0 ? (
                <EmptyState
                  title="All settled up!"
                  description="No outstanding balances"
                  className="py-8"
                />
              ) : (
                <div className="space-y-3">
                  {balances.slice(0, 5).map((b: any) => (
                    <div key={b.user.id} className="flex items-center gap-3">
                      <Avatar src={b.user.avatar} name={b.user.name} id={b.user.id} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{b.user.name}</div>
                      </div>
                      <div className={cn('text-sm font-semibold', b.net > 0 ? 'text-brand-600' : 'text-red-500')}>
                        {b.net > 0 ? 'owes you' : 'you owe'}
                        <br />
                        <span className="text-base">{formatCurrency(Math.abs(b.net), user?.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              <Link href="/activity" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4">
              {activityLoading ? (
                <SkeletonList count={3} />
              ) : activities.length === 0 ? (
                <EmptyState title="No activity yet" description="Add an expense to get started" className="py-8" />
              ) : (
                <div className="space-y-4">
                  {activities.slice(0, 6).map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <Avatar src={a.user.avatar} name={a.user.name} id={a.user.id} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{a.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateRelative(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Groups */}
        {groups.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Your Groups</h2>
              <Link href="/groups" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.slice(0, 3).map((g: any) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="card p-4 hover:border-brand-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center text-lg shrink-0">
                      {g.avatar ? (
                        <img src={g.avatar} alt={g.name} className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        '👥'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{g.name}</div>
                      <div className="text-xs text-gray-500">{g.members?.length || 0} members · {g._count?.expenses || 0} expenses</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
