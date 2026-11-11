'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Users, Plus, Search } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { AvatarGroup } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/loading';
import { getGroupCategoryEmoji } from '@/lib/utils';

export default function GroupsPage() {
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups', showArchived],
    queryFn: () => fetch(`/api/groups?archived=${showArchived}`).then((r) => r.json()),
  });

  const filtered = groups.filter((g: { name: string }) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <Header title="Groups" />
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="page-header mb-0">
            <h1 className="page-title hidden lg:block">Groups</h1>
          </div>
          <Link href="/groups/new" className="btn btn-primary btn-md gap-2">
            <Plus className="h-4 w-4" />
            New Group
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="input pl-10"
          />
        </div>

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-secondary'}`}
          >
            Active
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
          >
            Archived
          </button>
        </div>

        {isLoading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(
              (group: {
                id: string;
                name: string;
                description?: string;
                category: string;
                currency: string;
                members?: Array<{ user: { id: string; name: string; avatar: string | null } }>;
                _count?: { expenses: number };
              }) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <div className="card cursor-pointer p-5 transition-all duration-200 hover:border-brand-300 hover:shadow-md">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="gradient-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl">
                        {getGroupCategoryEmoji(group.category)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-gray-900">{group.name}</h3>
                        {group.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {group.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <AvatarGroup
                        users={group.members?.map((m) => m.user) || []}
                        max={4}
                        size="xs"
                      />
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {group._count?.expenses || 0} expenses
                        </div>
                        <div className="text-xs text-gray-400">{group.currency}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
