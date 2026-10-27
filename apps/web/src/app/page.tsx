'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { ContextualLoader } from '@ui/contextual-loader';
import { apiClient } from '@lib/api-client';
import {
  verifyPassportSession,
  getWorkspacePathForRole,
  extractApiErrorMessage,
  AuthUser,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';

interface VerifiedInviteInfo {
  valid: boolean;
  email?: string;
  role?: 'AGENT' | 'ADMIN';
  invitedBy?: string;
  message?: string;
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlInviteCode = searchParams.get('invite') || searchParams.get('inviteCode') || '';

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
  const [inviteCode, setInviteCode] = React.useState(urlInviteCode);
  const [showInviteInput, setShowInviteInput] = React.useState(Boolean(urlInviteCode));
  const [inviteInfo, setInviteInfo] = React.useState<VerifiedInviteInfo | null>(null);
  const [isVerifyingInvite, setIsVerifyingInvite] = React.useState(false);
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

  // If an invite code is present in URL, auto-switch to register mode and verify invite
  React.useEffect(() => {
    if (urlInviteCode) {
      setMode('register');
      setInviteCode(urlInviteCode);
      setShowInviteInput(true);
      verifyCode(urlInviteCode);
    }
  }, [urlInviteCode]);

  const verifyCode = async (code: string) => {
    if (!code.trim()) {
      setInviteInfo(null);
      return;
    }

    setIsVerifyingInvite(true);
    try {
      const res = await apiClient.get<VerifiedInviteInfo>(
        `/auth/invites/verify/${encodeURIComponent(code.trim())}`,
      );
      setInviteInfo(res.data);
      if (res.data.email && !email) {
        setEmail(res.data.email);
      }
    } catch {
      setInviteInfo({ valid: false, message: 'Unable to verify invitation code' });
    } finally {
      setIsVerifyingInvite(false);
    }
  };

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
        const payload: {
          fullName: string;
          email: string;
          password: string;
          inviteCode?: string;
        } = {
          fullName,
          email,
          password,
        };

        if (inviteCode.trim()) {
          payload.inviteCode = inviteCode.trim();
        }

        const res = await apiClient.post('/auth/register', payload);
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
                  : inviteInfo?.valid
                    ? `Staff Invitation: Registering as ${inviteInfo.role === 'ADMIN' ? 'Administrator' : 'Support Engineer'}.`
                    : 'Register as a customer to submit and track support tickets.'}
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

              {mode === 'register' && inviteInfo && (
                <div
                  className={`p-3 rounded-md border text-xs space-y-1 ${
                    inviteInfo.valid
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {inviteInfo.valid ? (
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        <strong>Staff Invitation Detected:</strong> Role:{' '}
                        <Badge variant="default" className="ml-1 text-[10px]">
                          {inviteInfo.role === 'ADMIN'
                            ? 'Administrator'
                            : 'Support Engineer'}
                        </Badge>
                      </span>
                    </div>
                  ) : (
                    <span>{inviteInfo.message || 'Invalid or expired invitation code.'}</span>
                  )}
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

              {/* Staff invitation code toggle (Invite-only mechanism) */}
              {mode === 'register' && (
                <div className="pt-1">
                  {!showInviteInput ? (
                    <button
                      type="button"
                      onClick={() => setShowInviteInput(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      Have an IT staff invitation code?
                    </button>
                  ) : (
                    <div className="space-y-1.5 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="inviteCode" className="text-xs font-semibold">
                          Staff Invitation Code
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowInviteInput(false);
                            setInviteCode('');
                            setInviteInfo(null);
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="inviteCode"
                          placeholder="e.g. inv_xxxxxxxxxxxx"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          className="text-xs h-8"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => verifyCode(inviteCode)}
                          disabled={isVerifyingInvite || !inviteCode.trim()}
                          className="text-xs h-8 shrink-0"
                        >
                          {isVerifyingInvite ? 'Checking...' : 'Apply'}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        IT Support Engineers and Administrators must be invited by an IT Administrator.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Authenticating...'
                  : mode === 'login'
                    ? 'Sign In'
                    : inviteInfo?.valid
                      ? 'Activate Staff Account'
                      : 'Create Customer Account'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function AuthRootPage() {
  return (
    <React.Suspense
      fallback={
        <ContextualLoader
          context="auth-session"
          label="Loading Authentication"
          sublabel="Please wait..."
        />
      }
    >
      <AuthForm />
    </React.Suspense>
  );
}
