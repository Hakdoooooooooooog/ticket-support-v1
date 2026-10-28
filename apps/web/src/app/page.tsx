'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContextualLoader } from '@ui/contextual-loader';
import { ThemeToggle } from '@components/theme-toggle';
import { AuthCard } from '@components/auth/auth-card';
import { LoginForm } from '@components/auth/login-form';
import { RegisterForm, VerifiedInviteInfo } from '@components/auth/register-form';
import { DemoAccountsBar } from '@components/auth/demo-accounts-bar';
import { apiClient } from '@lib/api-client';
import { APP_VERSION } from '@lib/constants';
import {
  verifyPassportSession,
  getWorkspacePathForRole,
  extractApiErrorMessage,
  AuthUser,
} from '@lib/helpers';
import { useAuthStore } from '@store/auth.store';

function AuthContainer() {
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
        const res = await apiClient.post('/auth/login', { email, password });
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
        extractApiErrorMessage(err, 'Authentication failed. Check your credentials.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDevAccount = (devEmail: string, devPass: string) => {
    setEmail(devEmail);
    setPassword(devPass);
    setError(null);
  };

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-spruce-50 dark:bg-spruce-950 text-spruce-950 dark:text-spruce-50 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-spruce-700 bg-spruce-100 dark:bg-spruce-800/80 dark:text-spruce-300 rounded-full border border-spruce-200 dark:border-spruce-700/60">
            Support Desk
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-spruce-950 dark:text-white">
            TicketSupport
          </h1>
          <p className="text-sm text-spruce-600 dark:text-spruce-300">
            Sign in to submit support requests or manage the service desk queue.
          </p>
        </div>

        <AuthCard
          mode={mode}
          onModeChange={(newMode) => {
            setMode(newMode);
            setError(null);
          }}
          isStaffInvite={inviteInfo?.valid}
          staffRole={inviteInfo?.role}
        >
          {mode === 'login' ? (
            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleAuthSubmit}
            >
              <DemoAccountsBar
                onSelectAccount={handleSelectDevAccount}
                disabled={isSubmitting}
              />
            </LoginForm>
          ) : (
            <RegisterForm
              fullName={fullName}
              setFullName={setFullName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              inviteCode={inviteCode}
              setInviteCode={setInviteCode}
              showInviteInput={showInviteInput}
              setShowInviteInput={setShowInviteInput}
              inviteInfo={inviteInfo}
              setInviteInfo={setInviteInfo}
              isVerifyingInvite={isVerifyingInvite}
              onVerifyInvite={verifyCode}
              error={error}
              isSubmitting={isSubmitting}
              onSubmit={handleAuthSubmit}
            />
          )}
        </AuthCard>

        <p className="text-center font-mono text-[11px] text-slate-500 pt-2">
          TicketSupport · {APP_VERSION}
        </p>
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
      <AuthContainer />
    </React.Suspense>
  );
}
