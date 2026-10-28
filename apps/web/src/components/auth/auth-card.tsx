'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@ui/card';

export interface AuthCardProps {
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
  isStaffInvite?: boolean;
  staffRole?: 'ADMIN' | 'AGENT';
  children: React.ReactNode;
}

export function AuthCard({
  mode,
  onModeChange,
  isStaffInvite,
  staffRole,
  children,
}: AuthCardProps) {
  return (
    <Card className="shadow-lg border-spruce-200 dark:border-spruce-700/80">
      <CardHeader className="space-y-3 pb-4">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-spruce-100 dark:bg-spruce-900 border border-spruce-200 dark:border-spruce-800">
          <button
            type="button"
            onClick={() => onModeChange('login')}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white text-spruce-950 shadow-sm dark:bg-spruce-800 dark:text-spruce-200'
                : 'text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onModeChange('register')}
            className={`py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white text-spruce-950 shadow-sm dark:bg-spruce-800 dark:text-spruce-200'
                : 'text-spruce-600 hover:text-spruce-950 dark:text-spruce-400 dark:hover:text-white'
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
              : isStaffInvite
                ? `Staff Invitation: Registering as ${staffRole === 'ADMIN' ? 'Administrator' : 'Support Engineer'}.`
                : 'Register as a customer to submit and track support tickets.'}
          </CardDescription>
        </div>
      </CardHeader>

      {children}
    </Card>
  );
}
