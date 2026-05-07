'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Receipt,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  PlusCircle,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { useMemo } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'Friends', href: '/friends', icon: UserPlus },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, pro: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const user = session?.user

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">Splitlyst</span>
        {user?.isPro && (
          <span className="ml-auto badge badge-yellow text-[10px]">PRO</span>
        )}
      </div>

      {/* Quick Action */}
      <div className="px-4 py-3">
        <Link
          href="/expenses/new"
          className="btn btn-primary btn-md w-full gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Expense
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {navigation.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('w-5 h-5', active ? 'text-brand-600' : 'text-gray-400')} />
              <span>{item.name}</span>
              {item.pro && !user?.isPro && (
                <span className="ml-auto badge badge-yellow text-[9px] px-1.5">PRO</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5',
            pathname === '/settings'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          )}
        >
          <Settings className={cn('w-5 h-5', pathname === '/settings' ? 'text-brand-600' : 'text-gray-400')} />
          Settings
        </Link>

        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg bg-gray-50">
            <Avatar
              src={user.image}
              name={user.name || 'User'}
              id={user.id}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
