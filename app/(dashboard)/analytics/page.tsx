'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Download } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { formatCurrency, getCategoryEmoji } from '@/lib/utils';
import { cn } from '@/lib/utils';

const COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

const PERIODS = [
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '12 months', value: 12 },
];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [months, setMonths] = useState(6);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', months],
    queryFn: () => fetch(`/api/analytics?months=${months}`).then((r) => r.json()),
  });

  const currency = session?.user?.currency || 'USD';

  return (
    <div>
      <Header title="Analytics" />
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="page-title hidden lg:block">Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setMonths(p.value)}
                className={cn('btn btn-sm', months === p.value ? 'btn-primary' : 'btn-secondary')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : !data ? (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No data yet"
            description="Add expenses to see analytics"
          />
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                {
                  label: 'Total spent',
                  value: formatCurrency(data.summary.totalSpent, currency),
                  sub: `over ${months} months`,
                  color: 'text-gray-900',
                },
                {
                  label: 'Monthly avg',
                  value: formatCurrency(data.summary.avgMonthly, currency),
                  sub: 'average per month',
                  color: 'text-blue-600',
                },
                {
                  label: 'Total expenses',
                  value: data.summary.totalExpenses,
                  sub: 'expense records',
                  color: 'text-purple-600',
                },
                {
                  label: 'Top category',
                  value: `${getCategoryEmoji(data.summary.topCategory)} ${data.summary.topCategory}`,
                  sub: 'most spending',
                  color: 'text-brand-600',
                },
              ].map((stat) => (
                <div key={stat.label} className="card p-4">
                  <div className="mb-1 text-xs text-gray-500">{stat.label}</div>
                  <div className={cn('text-xl font-bold capitalize', stat.color)}>{stat.value}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Monthly spending chart */}
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-900">Monthly Spending</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={data.monthlyData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Your share" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="mb-4 font-semibold text-gray-900">By Category</h2>
                {data.categoryData.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={data.categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="total"
                          nameKey="category"
                        >
                          {data.categoryData.map((_: unknown, index: number) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value), currency)}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-2">
                      {data.categoryData
                        .slice(0, 5)
                        .map((cat: { category: string; total: number }, i: number) => (
                          <div key={cat.category} className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="flex-1 text-sm capitalize">
                              {getCategoryEmoji(cat.category)} {cat.category}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(cat.total, currency)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>

              {/* Top expenses */}
              <div className="card p-5">
                <h2 className="mb-4 font-semibold text-gray-900">Top Expenses</h2>
                <div className="space-y-3">
                  {data.topExpenses.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">No data</div>
                  ) : (
                    data.topExpenses.map(
                      (
                        e: { id: string; description: string; category: string; amount: number },
                        i: number,
                      ) => (
                        <div key={e.id} className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                            {i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {e.description}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {getCategoryEmoji(e.category)} {e.category}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(e.amount, currency)}
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Spending trend */}
            <div className="card p-5">
              <h2 className="mb-4 font-semibold text-gray-900">Spending Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={data.monthlyData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 4 }}
                    name="Your share"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Export */}
            <div className="flex flex-wrap items-end justify-center gap-3">
              <div>
                <label className="label">From</label>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className="input"
                  data-testid="export-from"
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className="input"
                  data-testid="export-to"
                />
              </div>
              {(['csv', 'json'] as const).map((t) => (
                <a
                  key={t}
                  href={`/api/export?type=${t}${exportFrom ? `&from=${exportFrom}` : ''}${exportTo ? `&to=${exportTo}` : ''}`}
                  className="btn btn-secondary btn-md gap-2"
                  data-testid={`export-${t}`}
                >
                  <Download className="h-4 w-4" />
                  Export {t.toUpperCase()}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
