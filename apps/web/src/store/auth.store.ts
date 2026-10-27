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
} from '@lib/helpers';

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
        setStoredSession(session);
        set({
          user: session.user,
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
        const cachedUser = state.user || stored?.user || null;

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
              setStoredSession({ accessToken: token, user: verifiedUser });
              set({
                user: verifiedUser,
                accessToken: token,
                isSessionVerified: true,
                isVerifyingSession: false,
              });
              return verifiedUser;
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
        user: state.user,
        accessToken: state.accessToken,
        isSessionVerified: state.isSessionVerified,
      }),
    },
  ),
);
