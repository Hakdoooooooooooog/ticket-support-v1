'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AuthUser,
  AuthSession,
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  verifyPassportSession,
  sanitizeAuthUser,
} from '@lib/helpers';
import { registerAuthTokenGetter } from '@lib/api-client';

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isSessionVerified: boolean;
  isVerifyingSession: boolean;

  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  ensureSessionVerified: () => Promise<AuthUser | null>;
}

let inFlightVerification: Promise<AuthUser | null> | null = null;

// Self-healing: Proactively scrub legacy plaintext tokens from existing sessionStorage
if (typeof window !== 'undefined') {
  try {
    const rawZustandAuth = window.sessionStorage.getItem('ts_zustand_auth_store');
    if (rawZustandAuth && rawZustandAuth.includes('"accessToken"')) {
      const parsed = JSON.parse(rawZustandAuth);
      if (parsed?.state && 'accessToken' in parsed.state) {
        delete parsed.state.accessToken;
        window.sessionStorage.setItem('ts_zustand_auth_store', JSON.stringify(parsed));
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isSessionVerified: false,
      isVerifyingSession: false,

      setSession: (session: AuthSession) => {
        const sanitizedUser = sanitizeAuthUser(session.user);
        if (!sanitizedUser) return;

        setStoredSession({
          accessToken: session.accessToken,
          user: sanitizedUser,
        });

        set({
          user: sanitizedUser,
          accessToken: session.accessToken,
          isSessionVerified: true,
          isVerifyingSession: false,
        });
      },

      clearSession: () => {
        clearStoredSession();
        set({
          user: null,
          accessToken: null,
          isSessionVerified: false,
          isVerifyingSession: false,
        });
      },

      ensureSessionVerified: async () => {
        const state = get();

        // Already verified in this session -> 0ms return, no loading screen
        if (state.isSessionVerified && state.user && state.accessToken) {
          return state.user;
        }

        const stored = getStoredSession();
        const token = state.accessToken || stored?.accessToken || null;
        const cachedUser = state.user || (stored?.user ? sanitizeAuthUser(stored.user) : null);

        if (!token) {
          set({
            user: null,
            accessToken: null,
            isSessionVerified: false,
            isVerifyingSession: false,
          });
          return null;
        }

        if (cachedUser && !state.user) {
          set({ user: cachedUser, accessToken: token });
        }

        if (inFlightVerification) {
          return inFlightVerification;
        }

        if (!cachedUser) {
          set({ isVerifyingSession: true });
        }

        inFlightVerification = verifyPassportSession(token)
          .then((verifiedUser) => {
            if (verifiedUser) {
              const sanitized = sanitizeAuthUser(verifiedUser)!;
              setStoredSession({ accessToken: token, user: sanitized });
              set({
                user: sanitized,
                accessToken: token,
                isSessionVerified: true,
                isVerifyingSession: false,
              });
              return sanitized;
            } else {
              clearStoredSession();
              set({
                user: null,
                accessToken: null,
                isSessionVerified: false,
                isVerifyingSession: false,
              });
              return null;
            }
          })
          .finally(() => {
            inFlightVerification = null;
          });

        return inFlightVerification;
      },
    }),
    {
      name: 'ts_zustand_auth_store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user ? sanitizeAuthUser(state.user) : null,
        // SECURITY: accessToken is deliberately omitted so sessionStorage NEVER contains JWT credentials.
        // The token is held strictly in-memory during active sessions.
        isSessionVerified: state.isSessionVerified,
      }),
    },
  ),
);

// Register in-memory token getter with the API client
registerAuthTokenGetter(() => {
  return useAuthStore.getState().accessToken || getStoredSession()?.accessToken || null;
});
