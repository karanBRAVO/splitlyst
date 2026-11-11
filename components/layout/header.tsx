'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Bell, Zap } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';

interface HeaderProps {
  title?: string;
  back?: string;
  actions?: React.ReactNode;
}

export function Header({ title, back, actions }: HeaderProps) {
  const { data: session } = useSession();
  const user = session?.user;

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?unreadOnly=true');
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.count || 0;

  return (
    <>
      {/* Desktop: the mobile header is hidden, so page actions get their own slim bar */}
      {actions && (
        <div
          data-testid="desktop-actions"
          className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-gray-200 bg-white/80 px-6 py-2 backdrop-blur-md lg:flex"
        >
          {actions}
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          {back ? (
            <Link href={back} className="-ml-2 rounded-lg p-2 hover:bg-gray-100">
              <svg
                className="h-5 w-5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="gradient-brand flex h-7 w-7 items-center justify-center rounded-lg">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-gray-900">Splitlyst</span>
            </div>
          )}

          {title && (
            <h1 className="flex-1 text-center text-base font-semibold text-gray-900">{title}</h1>
          )}

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Link href="/activity" className="relative rounded-lg p-2 hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500" />
              )}
            </Link>
            {user && (
              <Link href="/settings">
                <Avatar src={user.image} name={user.name || 'User'} id={user.id} size="sm" />
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
