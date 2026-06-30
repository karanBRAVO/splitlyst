'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Activity, Bell, CheckCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { formatDateRelative } from '@/lib/utils';

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
};

export default function ActivityPage() {
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => fetch('/api/activity?limit=50').then((r) => r.json()),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/notifications').then((r) => r.json()),
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      fetch('/api/notifications?markAllRead=true', { method: 'PATCH' }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const unreadCount = notifications.filter((n: { read: boolean }) => !n.read).length;

  // Auto-mark all as read when the activity page is opened and notifications are loaded
  useEffect(() => {
    if (unreadCount > 0) {
      markAllRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount > 0]);

  return (
    <div>
      <Header title="Activity" />
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title hidden lg:block">Activity</h1>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="btn btn-ghost btn-sm gap-2 text-brand-600"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications */}
        {unreadCount > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-gray-700">Notifications</h2>
              <span className="badge badge-green">{unreadCount} new</span>
            </div>
            <div className="space-y-2">
              {notifications
                .filter((n: { read: boolean }) => !n.read)
                .map((n: { id: string; title: string; message: string; createdAt: string }) => (
                  <div key={n.id} className="card border-l-4 border-brand-500 p-4">
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="mt-0.5 text-sm text-gray-600">{n.message}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {formatDateRelative(n.createdAt)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Activity feed */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Recent Activity</h2>
          {isLoading ? (
            <SkeletonList count={5} />
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="No activity yet"
              description="Expense activity from you and your groups will appear here"
            />
          ) : (
            <div className="space-y-1">
              {activities.map(
                (activity: {
                  id: string;
                  type: string;
                  description: string;
                  createdAt: string;
                  group?: { id: string; name: string };
                  expense?: { id: string };
                }) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="mt-0.5 shrink-0 text-xl">
                      {activityIcons[activity.type] || '📋'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800">{activity.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {activity.group && (
                          <Link
                            href={`/groups/${activity.group.id}`}
                            className="text-xs text-brand-600 hover:text-brand-700"
                          >
                            {activity.group.name}
                          </Link>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDateRelative(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                    {activity.expense && (
                      <Link
                        href={`/expenses/${activity.expense.id}`}
                        className="shrink-0 text-xs text-brand-600 hover:text-brand-700"
                      >
                        View
                      </Link>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
