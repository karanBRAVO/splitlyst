'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/loading';
import { toast } from '@/components/ui/toaster';

export default function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['join', code],
    queryFn: async () => {
      const r = await fetch(`/api/groups/join/${code}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      return json as {
        id: string;
        name: string;
        description: string | null;
        alreadyMember: boolean;
        _count: { members: number };
      };
    },
    retry: false,
  });

  const join = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/groups/join/${code}`, { method: 'POST' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      return json as { groupId: string };
    },
    onSuccess: (res) => router.push(`/groups/${res.groupId}`),
    onError: (err: Error) => toast({ type: 'error', title: 'Failed', description: err.message }),
  });

  return (
    <div>
      <Header title="Join group" />
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="card p-6 text-center">
          {isLoading ? (
            <Spinner className="mx-auto h-6 w-6" />
          ) : error || !data ? (
            <>
              <h1 className="mb-2 text-lg font-semibold text-gray-900">Invite not available</h1>
              <p className="text-sm text-gray-500">{(error as Error)?.message}</p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Users className="h-6 w-6" />
              </div>
              <h1 className="text-lg font-semibold text-gray-900">{data.name}</h1>
              {data.description && <p className="mt-1 text-sm text-gray-500">{data.description}</p>}
              <p className="mt-1 text-xs text-gray-400">{data._count.members} members</p>
              {data.alreadyMember ? (
                <button
                  onClick={() => router.push(`/groups/${data.id}`)}
                  className="btn btn-primary btn-md mt-5 w-full"
                >
                  You&apos;re already a member — open group
                </button>
              ) : (
                <button
                  onClick={() => join.mutate()}
                  disabled={join.isPending}
                  className="btn btn-primary btn-md mt-5 w-full"
                >
                  {join.isPending ? <Spinner className="h-4 w-4" /> : 'Join group'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
