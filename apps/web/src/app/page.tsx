'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ContextualLoader } from '@ui/contextual-loader';
import { ThemeToggle } from '@components/theme-toggle';
import { AuthCard } from '@components/auth/auth-card';
import { LoginForm } from '@components/auth/login-form';
import { RegisterForm, VerifiedInviteInfo } from '@components/auth/register-form';
import { DemoAccountsBar } from '@components/auth/demo-accounts-bar';
import {
  authControllerVerifyInvite,
  authControllerLogin,
  authControllerRegister,
} from '../api/endpoints/authentication/authentication';
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
      const res = (await authControllerVerifyInvite(code.trim())) as any;
      setInviteInfo(res);
      if (res?.email && !email) {
        setEmail(res.email);
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
        const res = (await authControllerLogin({ email, password })) as any;
        const { accessToken, user } = res;
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
        const res = (await authControllerRegister(payload as any)) as any;
        const { accessToken, user } = res;
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
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-spruce-50 dark:bg-spruce-950 text-spruce-950 dark:text-spruce-50 relative overflow-hidden">
      {/* Ambient Top Aurora Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      >
        <div
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-spruce-400/20 to-spruce-600/30 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="max-w-md w-full mx-auto space-y-7 relative z-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-spruce-800 dark:text-spruce-300 bg-spruce-100 dark:bg-spruce-900/90 rounded-full border border-spruce-200 dark:border-spruce-700/80 shadow-sm backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-spruce-500 dark:bg-spruce-400 animate-pulse" />
            <span>Support Desk</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-spruce-950 dark:text-white drop-shadow-sm">
            TicketSupport
          </h1>
          <p className="text-sm text-spruce-600 dark:text-spruce-300/90 max-w-sm mx-auto">
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

        <p className="text-center font-mono text-[11px] text-spruce-500/80 dark:text-spruce-400/60 pt-2">
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
