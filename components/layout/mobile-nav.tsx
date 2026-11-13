'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/use-t';

// The bar only has room for four pages and the "Add" button; everything else lives under "More"
// so every page the desktop sidebar links to is reachable on a phone too.
const barItems = [
  { key: 'nav.home', href: '/dashboard', icon: LayoutDashboard },
  { key: 'nav.groups', href: '/groups', icon: Users },
  { key: 'nav.add', href: '/expenses/new', icon: PlusCircle, special: true },
  { key: 'nav.activity', href: '/activity', icon: Activity },
];

const moreItems = [
  { key: 'nav.friends', href: '/friends', icon: UserPlus },
  { key: 'nav.expenses', href: '/expenses', icon: Receipt },
  { key: 'nav.payments', href: '/payments', icon: Wallet },
  { key: 'nav.analytics', href: '/analytics', icon: BarChart3 },
  { key: 'nav.settings', href: '/settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => {
    // "/expenses/new" is the Add button, not the Expenses list
    if (href === '/expenses' && pathname.startsWith('/expenses/new')) return false;
    return pathname === href || pathname.startsWith(href + '/');
  };
  const moreActive = moreItems.some((i) => isActive(i.href));

  // Escape closes the menu
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {barItems.map((item) => {
            const active = isActive(item.href);

            if (item.special) {
              return (
                <Link
                  key={item.key}
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
                key={item.key}
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

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            data-testid="more-button"
            data-active={moreActive}
            className="flex min-w-[52px] flex-col items-center gap-0.5 py-1"
          >
            <Menu
              className={cn(
                'h-5 w-5 transition-colors',
                moreActive ? 'text-brand-600' : 'text-gray-400',
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium transition-colors',
                moreActive ? 'text-brand-600' : 'text-gray-400',
              )}
            >
              {t('nav.more')}
            </span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.more')}
          data-testid="more-sheet"
        >
          <button
            type="button"
            aria-label="Close menu"
            data-testid="more-backdrop"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />
          <div className="pb-safe absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-100 text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
