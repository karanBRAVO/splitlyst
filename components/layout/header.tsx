'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { useQuery } from '@tanstack/react-query'

interface HeaderProps {
  title?: string
  back?: string
  actions?: React.ReactNode
}

export function Header({ title, back, actions }: HeaderProps) {
  const { data: session } = useSession()
  const user = session?.user

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?unreadOnly=true')
      if (!res.ok) return { count: 0 }
      return res.json()
    },
    refetchInterval: 30000,
  })

  const unreadCount = notifications?.count || 0

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="flex items-center gap-3 px-4 py-3">
        {back ? (
          <Link href={back} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900">Splitlyst</span>
          </div>
        )}

        {title && (
          <h1 className="text-base font-semibold text-gray-900 flex-1 text-center">{title}</h1>
        )}

        <div className="ml-auto flex items-center gap-2">
          {actions}
          <Link href="/activity" className="relative p-2 rounded-lg hover:bg-gray-100">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
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
  )
}
