import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getStoredGuestToken,
  setStoredGuestToken,
  clearStoredGuestToken,
  getGuestStatus,
  fetchChildren,
  ChildProfile,
} from '../lib/api';

const ACTIVE_CHILD_ID_KEY = 'appu_active_child_id';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isGuest: boolean;
  guestToken: string | null;
  guestRemainingQuota: number;
  activeChildId: string | null;
  activeChild: ChildProfile | null;
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
  setActiveChild: (child: ChildProfile | null) => Promise<void>;
  setActiveChildId: (childId: string | null) => Promise<void>;
  refreshChildren: () => Promise<ChildProfile[]>;
}

let authSubscriptionInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isGuest: true,
  guestToken: null,
  guestRemainingQuota: 3,
  activeChildId: null,
  activeChild: null,
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

  setActiveChild: async (child: ChildProfile | null) => {
    try {
      if (child) {
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, child.id);
        set({ activeChildId: child.id, activeChild: child });
      } else {
        await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY);
        set({ activeChildId: null, activeChild: null });
      }
    } catch (e) {
      console.warn('[AuthStore] Failed to store active child:', e);
      set({ activeChildId: child?.id || null, activeChild: child });
    }
  },

  setActiveChildId: async (childId: string | null) => {
    try {
      if (childId) {
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, childId);
        set((state) => ({
          activeChildId: childId,
          activeChild: state.activeChild?.id === childId ? state.activeChild : null,
        }));
      } else {
        await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY);
        set({ activeChildId: null, activeChild: null });
      }
    } catch (e) {
      console.warn('[AuthStore] Failed to store active child id:', e);
      set({ activeChildId: childId });
    }
  },

  refreshChildren: async () => {
    const session = get().session;
    if (!session?.access_token) return [];
    try {
      const children = await fetchChildren(session.access_token);
      const currentActiveId = get().activeChildId || (await AsyncStorage.getItem(ACTIVE_CHILD_ID_KEY));
      let resolvedChild = children.find((c) => c.id === currentActiveId) || null;
      if (!resolvedChild && children.length > 0) {
        resolvedChild = children[0];
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, resolvedChild.id);
      }
      set({
        activeChildId: resolvedChild?.id || null,
        activeChild: resolvedChild,
      });
      return children;
    } catch (e) {
      console.warn('[AuthStore] Failed to refresh children:', e);
      return [];
    }
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
        const token = sessionData.session.access_token;
        const storedChildId = await AsyncStorage.getItem(ACTIVE_CHILD_ID_KEY);
        let activeChild: ChildProfile | null = null;
        let activeChildId: string | null = storedChildId;

        try {
          const children = await fetchChildren(token);
          activeChild = children.find((c) => c.id === storedChildId) || null;
          if (!activeChild && children.length > 0) {
            activeChild = children[0];
            activeChildId = activeChild.id;
            await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, activeChild.id);
          }
        } catch {
          // Non-blocking
        }

        set({
          user: sessionData.session.user,
          session: sessionData.session,
          isGuest: false,
          activeChildId,
          activeChild,
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
          activeChildId: null,
          activeChild: null,
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
            void get().refreshChildren().catch(() => {});
          } else if (event === 'SIGNED_OUT') {
            await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY).catch(() => {});
            set({
              user: null,
              session: null,
              isGuest: true,
              activeChildId: null,
              activeChild: null,
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
      await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY).catch(() => {});
      set({
        user: null,
        session: null,
        isGuest: true,
        guestToken: null,
        activeChildId: null,
        activeChild: null,
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
