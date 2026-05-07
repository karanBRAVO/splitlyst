'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Plus } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { toast } from '@/components/ui/toaster'
import { Spinner } from '@/components/ui/loading'
import { CURRENCIES, GROUP_CATEGORIES } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  currency: z.string().default('USD'),
  category: z.string().default('other'),
})

type FormData = z.infer<typeof schema>

export default function NewGroupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [memberEmail, setMemberEmail] = useState('')
  const [memberEmails, setMemberEmails] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { currency: 'USD', category: 'other' } })

  const mutation = useMutation({
    mutationFn: (data: FormData & { memberEmails: string[] }) =>
      fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error)
        return json
      }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast({ type: 'success', title: 'Group created!', description: `"${group.name}" is ready.` })
      router.push(`/groups/${group.id}`)
    },
    onError: (err: Error) => {
      toast({ type: 'error', title: 'Failed to create group', description: err.message })
    },
  })

  const addEmail = () => {
    const email = memberEmail.trim().toLowerCase()
    if (!email || memberEmails.includes(email)) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ type: 'error', title: 'Invalid email' })
      return
    }
    setMemberEmails([...memberEmails, email])
    setMemberEmail('')
  }

  const selectedCategory = watch('category')

  return (
    <div>
      <Header title="New Group" back="/groups" />
      <div className="max-w-lg mx-auto px-4 py-6 lg:px-6">
        <div className="hidden lg:block mb-6">
          <h1 className="page-title">Create a group</h1>
          <p className="page-subtitle">Organize shared expenses with friends, family, or roommates</p>
        </div>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate({ ...data, memberEmails }))}
          className="space-y-5"
        >
          {/* Category */}
          <div>
            <label className="label">Group type</label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_CATEGORIES.map((cat) => (
                <label key={cat.value} className="cursor-pointer">
                  <input {...register('category')} type="radio" value={cat.value} className="sr-only" />
                  <div className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                    selectedCategory === cat.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">
                      {cat.label}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="label">Group name *</label>
            <input {...register('name')} className="input" placeholder="e.g. Roommates, Trip to Paris" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              {...register('description')}
              className="input resize-none"
              rows={2}
              placeholder="What is this group for?"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="label">Default currency</label>
            <select {...register('currency')} className="input">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Members */}
          <div>
            <label className="label">Invite members by email</label>
            <div className="flex gap-2">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                type="email"
                className="input flex-1"
                placeholder="friend@example.com"
              />
              <button type="button" onClick={addEmail} className="btn btn-secondary btn-md shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {memberEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {memberEmails.map((email) => (
                  <div key={email} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 rounded-full px-3 py-1 text-sm">
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => setMemberEmails(memberEmails.filter((e) => e !== email))}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary btn-lg flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn btn-primary btn-lg flex-1"
            >
              {mutation.isPending ? <Spinner className="w-4 h-4" /> : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
