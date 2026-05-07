'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Activity,
  Settings,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'Add', href: '/expenses/new', icon: PlusCircle, special: true },
  { name: 'Activity', href: '/activity', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-safe">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')

          if (item.special) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center gap-0.5 -mt-6"
              >
                <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/30">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-[10px] text-gray-500 mt-1">{item.name}</span>
              </Link>
            )
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center gap-0.5 min-w-[52px] py-1"
            >
              <item.icon
                className={cn(
                  'w-5 h-5 transition-colors',
                  active ? 'text-brand-600' : 'text-gray-400'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  active ? 'text-brand-600' : 'text-gray-400'
                )}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
