'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/components/ui/toaster';
import { Spinner } from '@/components/ui/loading';
import { GoogleButton } from '@/components/auth/google-button';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [showPassword, setShowPassword] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      totp: code,
      redirect: false,
    });

    if (result?.error === 'TOTP_REQUIRED') {
      setNeedsCode(true);
      return;
    }
    if (result?.error) {
      toast({ type: 'error', title: 'Sign in failed', description: result.error });
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="card p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your Splitlyst account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <div className="relative">
            <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              {...register('email')}
              type="email"
              className="input pl-10"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand-600 hover:text-brand-700">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className="input pr-10 pl-10"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {needsCode && (
          <div>
            <label className="label">Authentication code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              name="totp"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="input"
              placeholder="123456 or a recovery code"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">
              Enter the 6-digit code from your authenticator app, or a recovery code.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary btn-lg mt-2 w-full"
        >
          {isSubmitting ? <Spinner className="h-4 w-4" /> : 'Sign in'}
        </button>
      </form>

      <GoogleButton callbackUrl={callbackUrl} />

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Create one free
        </Link>
      </p>
    </div>
  );
}
