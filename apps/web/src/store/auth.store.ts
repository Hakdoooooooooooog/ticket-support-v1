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
  refreshPassportSession,
  logoutPassportSession,
  sanitizeAuthUser,
} from '@lib/helpers';
import {
  registerAuthTokenGetter,
  registerAuthSessionHandler,
} from '@lib/api-client';

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
        void logoutPassportSession();
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

        if (cachedUser && !state.user && token) {
          set({ user: cachedUser, accessToken: token });
        }

        if (inFlightVerification) {
          return inFlightVerification;
        }

        set({ isVerifyingSession: true });

        inFlightVerification = (async () => {
          try {
            // 1. If an access token exists, verify it with /auth/me
            if (token) {
              const verifiedUser = await verifyPassportSession(token);
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
              }
            }

            // 2. Access token is absent or expired: attempt silent refresh via httpOnly rt cookie
            const refreshed = await refreshPassportSession();
            if (refreshed) {
              const sanitized = sanitizeAuthUser(refreshed.user)!;
              setStoredSession({
                accessToken: refreshed.accessToken,
                user: sanitized,
              });
              set({
                user: sanitized,
                accessToken: refreshed.accessToken,
                isSessionVerified: true,
                isVerifyingSession: false,
              });
              return sanitized;
            }

            // 3. Unauthenticated or session completely expired
            clearStoredSession();
            set({
              user: null,
              accessToken: null,
              isSessionVerified: false,
              isVerifyingSession: false,
            });
            return null;
          } catch {
            clearStoredSession();
            set({
              user: null,
              accessToken: null,
              isSessionVerified: false,
              isVerifyingSession: false,
            });
            return null;
          } finally {
            inFlightVerification = null;
          }
        })();

        return inFlightVerification;
      },
    }),
    {
      name: 'ts_auth',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return window.sessionStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        // PRIVACY & SECURITY: PII (email, fullName) and credentials (accessToken)
        // are omitted from browser storage and maintained strictly in runtime memory.
        // Only minimal non-PII identity (id, role) is persisted to support page routing.
        user: state.user
          ? {
              id: state.user.id,
              role: state.user.role,
            }
          : null,
        isSessionVerified: state.isSessionVerified,
      }),
    },
  ),
);

// Register in-memory token getter with the API client
registerAuthTokenGetter(() => {
  return useAuthStore.getState().accessToken || getStoredSession()?.accessToken || null;
});

// Register session refresh handler to update store automatically when axios interceptor rotates tokens
registerAuthSessionHandler(
  (session) => {
    if (session.user) {
      useAuthStore.getState().setSession({
        accessToken: session.accessToken,
        user: session.user,
      });
    } else {
      useAuthStore.setState({ accessToken: session.accessToken });
    }
  },
  () => {
    useAuthStore.getState().clearSession();
  },
);
