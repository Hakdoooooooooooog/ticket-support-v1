'use client';

import * as React from 'react';
import { CardContent, CardFooter } from '@ui/card';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { Button } from '@ui/button';

export interface LoginFormProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  children?: React.ReactNode;
}

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  error,
  isSubmitting,
  onSubmit,
  children,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-xs font-medium rounded-md bg-red-50 text-red-800 border border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email Address</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Authenticating...' : 'Sign In'}
        </Button>
        {children}
      </CardFooter>
    </form>
  );
}
