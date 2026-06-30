'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'Friends', href: '/friends', icon: UserPlus },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, pro: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white lg:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
        <div className="gradient-brand flex h-8 w-8 items-center justify-center rounded-lg">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">Splitlyst</span>
        {user?.isPro && <span className="badge badge-yellow ml-auto text-[10px]">PRO</span>}
      </div>

      {/* Quick Action */}
      <div className="px-4 py-3">
        <Link href="/expenses/new" className="btn btn-primary btn-md w-full gap-2">
          <PlusCircle className="h-4 w-4" />
          Add Expense
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <item.icon className={cn('h-5 w-5', active ? 'text-brand-600' : 'text-gray-400')} />
              <span>{item.name}</span>
              {item.pro && !user?.isPro && (
                <span className="badge badge-yellow ml-auto px-1.5 text-[9px]">PRO</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-100 p-3">
        <Link
          href="/settings"
          className={cn(
            'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
            pathname === '/settings'
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <Settings
            className={cn('h-5 w-5', pathname === '/settings' ? 'text-brand-600' : 'text-gray-400')}
          />
          Settings
        </Link>

        {user && (
          <div className="mt-1 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
            <Avatar src={user.image} name={user.name || 'User'} id={user.id} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
