'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Activity, Settings, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/use-t';

const navItems = [
  { name: 'Home', key: 'nav.home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', key: 'nav.groups', href: '/groups', icon: Users },
  { name: 'Add', key: 'nav.add', href: '/expenses/new', icon: PlusCircle, special: true },
  { name: 'Activity', key: 'nav.activity', href: '/activity', icon: Activity },
  { name: 'Settings', key: 'nav.settings', href: '/settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');

          if (item.special) {
            return (
              <Link
                key={t(item.key)}
                href={item.href}
                className="-mt-6 flex flex-col items-center gap-0.5"
              >
                <div className="gradient-brand flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-brand-500/30">
                  <item.icon className="h-7 w-7 text-white" />
                </div>
                <span className="mt-1 text-[10px] text-gray-500">{t(item.key)}</span>
              </Link>
            );
          }

          return (
            <Link
              key={t(item.key)}
              href={item.href}
              className="flex min-w-[52px] flex-col items-center gap-0.5 py-1"
            >
              <item.icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  active ? 'text-brand-600' : 'text-gray-400',
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  active ? 'text-brand-600' : 'text-gray-400',
                )}
              >
                {t(item.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
