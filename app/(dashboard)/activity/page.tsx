'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Activity, Bell, CheckCheck } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonList } from '@/components/ui/loading'
import { formatDateRelative } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

const activityIcons: Record<string, string> = {
  expense_added: '💸',
  expense_updated: '✏️',
  expense_deleted: '🗑️',
  payment_recorded: '💰',
  group_created: '👥',
  member_added: '👋',
  member_removed: '👋',
  friend_added: '🤝',
  settled_up: '✅',
}

export default function ActivityPage() {
  const queryClient = useQueryClient()

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=50').then((r) => r.json()),
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then((r) => r.json()),
  })

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch('/api/notifications?markAllRead=true', { method: 'PATCH' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
    },
  })

  const unreadCount = notifications.filter((n: any) => !n.read).length

  return (
    <div>
      <Header title="Activity" />
      <div className="max-w-3xl mx-auto px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title hidden lg:block">Activity</h1>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="btn btn-ghost btn-sm gap-2 text-brand-600"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications */}
        {notifications.filter((n: any) => !n.read).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-700">Notifications</h2>
              <span className="badge badge-green">{unreadCount} new</span>
            </div>
            <div className="space-y-2">
              {notifications.filter((n: any) => !n.read).map((n: any) => (
                <div key={n.id} className="card p-4 border-l-4 border-brand-500">
                  <div className="font-medium text-sm text-gray-900">{n.title}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatDateRelative(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity feed */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
          {isLoading ? (
            <SkeletonList count={5} />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-8 h-8" />}
              title="No activity yet"
              description="Expense activity from you and your groups will appear here"
            />
          ) : (
            <div className="space-y-1">
              {activities.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="text-xl shrink-0 mt-0.5">
                    {activityIcons[activity.type] || '📋'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {activity.group && (
                        <Link
                          href={`/groups/${activity.group.id}`}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          {activity.group.name}
                        </Link>
                      )}
                      <span className="text-xs text-gray-400">{formatDateRelative(activity.createdAt)}</span>
                    </div>
                  </div>
                  {activity.expense && (
                    <Link
                      href={`/expenses/${activity.expense.id}`}
                      className="text-xs text-brand-600 hover:text-brand-700 shrink-0"
                    >
                      View
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
