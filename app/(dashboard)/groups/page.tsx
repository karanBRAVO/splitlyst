'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Users, Plus, Search, Archive } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonList } from '@/components/ui/loading'
import { getGroupCategoryEmoji, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

export default function GroupsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => fetch('/api/groups').then((r) => r.json()),
  })

  const filtered = groups.filter((g: any) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Header title="Groups" />
      <div className="max-w-4xl mx-auto px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="page-header mb-0">
            <h1 className="page-title hidden lg:block">Groups</h1>
          </div>
          <Link href="/groups/new" className="btn btn-primary btn-md gap-2">
            <Plus className="w-4 h-4" />
            New Group
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="input pl-10"
          />
        </div>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={search ? 'No groups found' : 'No groups yet'}
            description={
              search
                ? 'Try a different search term'
                : 'Create a group to start splitting expenses with friends or roommates'
            }
            action={
              !search && (
                <Link href="/groups/new" className="btn btn-primary btn-md">
                  Create your first group
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((group: any) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <div className="card p-5 hover:border-brand-300 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 gradient-brand rounded-xl flex items-center justify-center text-2xl shrink-0">
                      {getGroupCategoryEmoji(group.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{group.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <AvatarGroup
                      users={group.members?.map((m: any) => m.user) || []}
                      max={4}
                      size="xs"
                    />
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{group._count?.expenses || 0} expenses</div>
                      <div className="text-xs text-gray-400">{group.currency}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
