'use client';

import * as React from 'react';
import { CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';

export interface VerifiedInviteInfo {
  valid: boolean;
  email?: string;
  role?: 'AGENT' | 'ADMIN';
  invitedBy?: string;
  message?: string;
}

export interface RegisterFormProps {
  fullName: string;
  setFullName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  inviteCode: string;
  setInviteCode: (val: string) => void;
  showInviteInput: boolean;
  setShowInviteInput: (val: boolean) => void;
  inviteInfo: VerifiedInviteInfo | null;
  setInviteInfo: (val: VerifiedInviteInfo | null) => void;
  isVerifyingInvite: boolean;
  onVerifyInvite: (code: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function RegisterForm({
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  inviteCode,
  setInviteCode,
  showInviteInput,
  setShowInviteInput,
  inviteInfo,
  setInviteInfo,
  isVerifyingInvite,
  onVerifyInvite,
  error,
  isSubmitting,
  onSubmit,
}: RegisterFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {inviteInfo && (
          <div
            className={`p-3 rounded-lg border text-xs space-y-1 ${
              inviteInfo.valid
                ? 'bg-spruce-500/15 border-spruce-400/30 text-spruce-800 dark:text-spruce-200'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200'
            }`}
          >
            {inviteInfo.valid ? (
              <div className="flex items-center justify-between gap-2">
                <span>
                  <strong>Staff Invitation Detected:</strong> Role:{' '}
                  <Badge variant="default" className="ml-1 text-[10px]">
                    {inviteInfo.role === 'ADMIN' ? 'Administrator' : 'Support Engineer'}
                  </Badge>
                </span>
              </div>
            ) : (
              <span>{inviteInfo.message || 'Invalid or expired invitation code.'}</span>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="register-fullName">Full Name</Label>
          <Input
            id="register-fullName"
            placeholder="e.g. Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email Address</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {/* Staff invitation code toggle (Invite-only mechanism) */}
        <div className="pt-1">
          {!showInviteInput ? (
            <button
              type="button"
              onClick={() => setShowInviteInput(true)}
              className="text-xs text-spruce-600 hover:text-spruce-800 dark:text-spruce-300 dark:hover:text-spruce-100 hover:underline font-medium transition-colors cursor-pointer"
            >
              Have an IT staff invitation code?
            </button>
          ) : (
            <div className="space-y-2 p-3.5 rounded-lg bg-spruce-50 dark:bg-spruce-950/80 border border-spruce-200 dark:border-spruce-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="register-inviteCode" className="text-xs font-semibold text-spruce-900 dark:text-spruce-200">
                  Staff Invitation Code
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteInput(false);
                    setInviteCode('');
                    setInviteInfo(null);
                  }}
                  className="text-[11px] text-spruce-400 hover:text-spruce-600 dark:text-spruce-400 dark:hover:text-spruce-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="register-inviteCode"
                  placeholder="e.g. inv_xxxxxxxxxxxx"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="text-xs h-8"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onVerifyInvite(inviteCode)}
                  disabled={isVerifyingInvite || !inviteCode.trim()}
                  className="text-xs h-8 shrink-0"
                >
                  {isVerifyingInvite ? 'Checking...' : 'Apply'}
                </Button>
              </div>
              <p className="text-[11px] text-spruce-500 dark:text-spruce-400">
                IT Support Engineers and Administrators must be invited by an IT Administrator.
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? 'Creating Account...'
            : inviteInfo?.valid
              ? 'Activate Staff Account'
              : 'Create Customer Account'}
        </Button>
      </CardFooter>
    </form>
  );
}
