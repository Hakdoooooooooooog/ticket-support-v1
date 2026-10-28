'use client';

import * as React from 'react';
import { Button } from '@ui/button';

interface DemoAccountsBarProps {
  onSelectAccount: (email: string, pass: string) => void;
  disabled?: boolean;
}

/**
 * 1-Click Demo Credentials Bar for local development and QA testing.
 * STRICT SECURITY GUARD: Strictly disabled and completely hidden in production builds.
 */
export function DemoAccountsBar({ onSelectAccount, disabled }: DemoAccountsBarProps) {
  // Never render in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="pt-3 border-t border-spruce-200/80 dark:border-spruce-800/80 text-center space-y-2">
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-spruce-600 dark:text-spruce-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
        <span>Local Dev Shortcuts</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelectAccount('admin@ticketsupport.local', 'LocalDevAdminPassword123!')}
          className="text-[11px] h-7 px-2.5 rounded-md bg-spruce-100/70 hover:bg-spruce-200/80 text-spruce-800 dark:bg-spruce-950/60 dark:hover:bg-spruce-800 dark:text-spruce-200 border-spruce-300/70 dark:border-spruce-700/60"
        >
          Admin
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelectAccount('agent@ticketsupport.local', 'LocalDevAgentPassword123!')}
          className="text-[11px] h-7 px-2.5 rounded-md bg-spruce-100/70 hover:bg-spruce-200/80 text-spruce-800 dark:bg-spruce-950/60 dark:hover:bg-spruce-800 dark:text-spruce-200 border-spruce-300/70 dark:border-spruce-700/60"
        >
          Agent
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelectAccount('customer@ticketsupport.local', 'LocalDevCustomerPassword123!')}
          className="text-[11px] h-7 px-2.5 rounded-md bg-spruce-100/70 hover:bg-spruce-200/80 text-spruce-800 dark:bg-spruce-950/60 dark:hover:bg-spruce-800 dark:text-spruce-200 border-spruce-300/70 dark:border-spruce-700/60"
        >
          Customer
        </Button>
      </div>
    </div>
  );
}
