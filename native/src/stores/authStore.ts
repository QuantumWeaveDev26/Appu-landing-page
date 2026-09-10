import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  getStoredGuestToken,
  setStoredGuestToken,
  clearStoredGuestToken,
  getGuestStatus,
} from '../lib/api';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  guestToken: string | null;
  guestRemainingQuota: number;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    householdName?: string
  ) => Promise<{ needsVerification: boolean }>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  updateGuestQuota: (remaining: number, token?: string) => void;
}

let authSubscriptionInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isGuest: true,
  guestToken: null,
  guestRemainingQuota: 3,
  isLoading: false,
  isInitialized: false,
  error: null,

  clearError: () => set({ error: null }),

  updateGuestQuota: (remaining: number, token?: string) => {
    set((state) => ({
      guestRemainingQuota: remaining,
      guestToken: token || state.guestToken,
    }));
  },

  initialize: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      // 1. Check existing Supabase session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.warn('[AuthStore] Error reading session:', sessionError);
      }

      if (sessionData?.session) {
        set({
          user: sessionData.session.user,
          session: sessionData.session,
          isGuest: false,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        // 2. Hydrate guest session token & status
        const storedToken = await getStoredGuestToken();
        let remaining = 3;

        try {
          const guestRes = await getGuestStatus();
          const activeToken =
            guestRes.token ||
            guestRes.guest?.token ||
            guestRes.guestSession?.token ||
            storedToken;
          remaining = guestRes.remaining ?? 3;

          if (activeToken) {
            await setStoredGuestToken(activeToken);
          }
          set({ guestToken: activeToken, guestRemainingQuota: remaining });
        } catch {
          set({ guestToken: storedToken });
        }

        set({
          user: null,
          session: null,
          isGuest: true,
          isLoading: false,
          isInitialized: true,
        });
      }

      // 3. Listen for future auth state changes
      if (!authSubscriptionInitialized) {
        authSubscriptionInitialized = true;
        supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (newSession) {
            set({
              user: newSession.user,
              session: newSession,
              isGuest: false,
              isLoading: false,
            });
          } else if (event === 'SIGNED_OUT') {
            set({
              user: null,
              session: null,
              isGuest: true,
              isLoading: false,
            });
          }
        });
      }
    } catch (err: any) {
      set({
        error: err?.message || 'Failed to initialize authentication',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  signInWithEmail: async (email: string, pass: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        throw new Error(error.message || 'Sign in failed');
      }

      if (!data.session) {
        throw new Error('Sign in succeeded but no active session was returned');
      }

      set({
        user: data.session.user,
        session: data.session,
        isGuest: false,
        isLoading: false,
      });
    } catch (err: any) {
      const message = err?.message || 'Sign in failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  signUpWithEmail: async (
    email: string,
    pass: string,
    householdName: string = 'Family'
  ) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: householdName.trim() || 'Family',
            household_name: householdName.trim() || 'Family',
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Account creation failed');
      }

      const hasSession = Boolean(data.session);

      if (data.session) {
        set({
          user: data.session.user,
          session: data.session,
          isGuest: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }

      return { needsVerification: !hasSession };
    } catch (err: any) {
      const message = err?.message || 'Sign up failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw new Error(error.message || 'Google sign-in failed');
      }

      if (data.session) {
        set({
          user: data.session.user,
          session: data.session,
          isGuest: false,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      const message = err?.message || 'Google sign-in failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  continueAsGuest: async () => {
    set({ isLoading: true, error: null });
    try {
      let token = await getStoredGuestToken();
      if (!token) {
        try {
          const res = await getGuestStatus();
          token =
            res.token ||
            res.guest?.token ||
            res.guestSession?.token ||
            null;
          if (typeof res.remaining === 'number') {
            set({ guestRemainingQuota: res.remaining });
          }
        } catch {
          // Will be assigned on first message dispatch
        }
      }
      set({
        user: null,
        session: null,
        isGuest: true,
        guestToken: token,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        session: null,
        isGuest: true,
        isLoading: false,
      });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await supabase.auth.signOut();
      await clearStoredGuestToken();
      set({
        user: null,
        session: null,
        isGuest: true,
        guestToken: null,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err?.message || 'Sign out failed',
        isLoading: false,
      });
    }
  },
}));
