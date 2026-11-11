import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CURRENCIES } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currencies that have no minor unit (no cents)
const ZERO_DECIMAL = new Set(['JPY']);

export function formatCurrency(amount: number, currency = 'USD'): string {
  const decimals = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const body = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const curr = CURRENCIES.find((c) => c.code === currency);
  // Unknown codes: show the ISO code rather than a wrong symbol
  return `${curr ? curr.symbol : currency + ' '}${body}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateAvatarUrl(name: string, id?: string): string {
  const seed = id || name;
  return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=10b981&textColor=ffffff&fontSize=40`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : roundToTwoDecimals(parsed);
}

export function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    general: '🧾',
    food: '🍔',
    transport: '🚗',
    entertainment: '🎬',
    utilities: '💡',
    rent: '🏠',
    groceries: '🛒',
    healthcare: '🏥',
    travel: '✈️',
    shopping: '🛍️',
    sports: '⚽',
    education: '📚',
    gifts: '🎁',
    other: '📦',
  };
  return map[category] || '🧾';
}

export function getGroupCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    home: '🏠',
    trip: '✈️',
    couple: '💑',
    friends: '👫',
    work: '💼',
    family: '👨‍👩‍👧‍👦',
    other: '📦',
  };
  return map[category] || '📦';
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') ? `"${str}"` : str;
        })
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
