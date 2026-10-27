'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Button } from '@ui/button';
import { ContextualLoader } from '@ui/contextual-loader';
import { apiClient } from '@lib/api-client';
import {
  verifyPassportSession,
  getWorkspacePathForRole,
  extractApiErrorMessage,
  AuthUser,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';

export default function AuthRootPage() {
  const router = useRouter();
  const {
    user: storedUser,
    isSessionVerified,
    isVerifyingSession,
    setSession,
    ensureSessionVerified,
  } = useAuthStore();

  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [role, setRole] = React.useState<'CUSTOMER' | 'AGENT' | 'ADMIN'>('CUSTOMER');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const redirectByUserRole = React.useCallback(
    (user: AuthUser) => {
      router.replace(getWorkspacePathForRole(user.role));
    },
    [router],
  );

  React.useEffect(() => {
    if (isSessionVerified && storedUser) {
      redirectByUserRole(storedUser);
      return;
    }

    ensureSessionVerified().then((verifiedUser) => {
      if (verifiedUser) {
        redirectByUserRole(verifiedUser);
      }
    });
  }, [isSessionVerified, storedUser, ensureSessionVerified, redirectByUserRole]);

  if (isVerifyingSession && !storedUser) {
    return (
      <ContextualLoader
        context="auth-session"
        label="Signing You In"
        sublabel="Checking your account and opening your workspace..."
      />
    );
  }

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await apiClient.post('/auth/login', {
          email,
          password,
        });
        const { accessToken, user } = res.data;
        const verified = (await verifyPassportSession(accessToken)) || user;
        setSession({ accessToken, user: verified });
        redirectByUserRole(verified);
      } else {
        const res = await apiClient.post('/auth/register', {
          fullName,
          email,
          password,
          role,
        });
        const { accessToken, user } = res.data;
        const verified = (await verifyPassportSession(accessToken)) || user;
        setSession({ accessToken, user: verified });
        redirectByUserRole(verified);
      }
    } catch (err: unknown) {
      setError(
        extractApiErrorMessage(
          err,
          'Authentication failed. Check your credentials.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full dark:bg-blue-950 dark:text-blue-300">
            Support Desk
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            TicketSupport
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in to submit support requests or manage the service desk queue.
          </p>
        </div>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
            <div>
              <CardTitle className="text-xl">
                {mode === 'login' ? 'Welcome back' : 'Register an account'}
              </CardTitle>
              <CardDescription>
                {mode === 'login'
                  ? 'Enter your email and password to continue.'
                  : 'Set up a customer or support team account.'}
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleAuthSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-xs font-medium rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="e.g. Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="role">Account Role / Workspace</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as 'CUSTOMER' | 'AGENT' | 'ADMIN')
                    }
                    className="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:focus-visible:ring-slate-300"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="AGENT">Support Engineer</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Authenticating...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account & Continue'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
