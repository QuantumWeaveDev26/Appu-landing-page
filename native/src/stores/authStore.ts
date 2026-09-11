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
  fetchPersonalisation,
  ChildPersonalisation,
  HouseholdInfo,
  ensureHousehold,
} from '../lib/api';
import { signOutGoogle } from '../lib/googleAuth';

const ACTIVE_CHILD_ID_KEY = 'appu_active_child_id';

export interface AuthState {
  user: User | null;
  session: Session | null;
  household: HouseholdInfo | null;
  isGuest: boolean;
  guestToken: string | null;
  guestRemainingQuota: number;
  children: ChildProfile[];
  activeChildId: string | null;
  activeChild: ChildProfile | null;
  activePersonalisation: ChildPersonalisation | null;
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
  setActivePersonalisation: (p: ChildPersonalisation | null) => void;
  refreshChildren: () => Promise<ChildProfile[]>;
  hasCompletedPersonalisation: () => boolean;
}

let authSubscriptionInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  household: null,
  isGuest: true,
  guestToken: null,
  guestRemainingQuota: 0,
  children: [],
  activeChildId: null,
  activeChild: null,
  activePersonalisation: null,
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

  setActivePersonalisation: (p: ChildPersonalisation | null) => {
    set({ activePersonalisation: p });
  },

  hasCompletedPersonalisation: () => {
    const { activeChild, activePersonalisation } = get();
    return Boolean(activeChild && activePersonalisation);
  },

  setActiveChild: async (child: ChildProfile | null) => {
    try {
      const session = get().session;
      let pers: ChildPersonalisation | null = null;
      if (child && session?.access_token) {
        try {
          pers = await fetchPersonalisation(session.access_token, child.id);
        } catch {}
      }

      if (child) {
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, child.id);
        set({
          activeChildId: child.id,
          activeChild: child,
          activePersonalisation: pers,
        });
      } else {
        await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY);
        set({
          activeChildId: null,
          activeChild: null,
          activePersonalisation: null,
        });
      }
    } catch (e) {
      console.warn('[AuthStore] Failed to store active child:', e);
      set({ activeChildId: child?.id || null, activeChild: child });
    }
  },

  setActiveChildId: async (childId: string | null) => {
    try {
      const session = get().session;
      const target = get().children.find((c) => c.id === childId) || null;
      let pers: ChildPersonalisation | null = null;
      if (childId && session?.access_token) {
        try {
          pers = await fetchPersonalisation(session.access_token, childId);
        } catch {}
      }

      if (childId) {
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, childId);
        set({
          activeChildId: childId,
          activeChild: target,
          activePersonalisation: pers,
        });
      } else {
        await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY);
        set({
          activeChildId: null,
          activeChild: null,
          activePersonalisation: null,
        });
      }
    } catch (e) {
      console.warn('[AuthStore] Failed to store active child id:', e);
      set({ activeChildId: childId });
    }
  },

  refreshChildren: async () => {
    const session = get().session;
    if (!session?.access_token) {
      set({
        children: [],
        activeChildId: null,
        activeChild: null,
        activePersonalisation: null,
      });
      return [];
    }
    try {
      const children = await fetchChildren(session.access_token);
      const currentActiveId =
        get().activeChildId || (await AsyncStorage.getItem(ACTIVE_CHILD_ID_KEY));
      let resolvedChild = children.find((c) => c.id === currentActiveId) || null;
      if (!resolvedChild && children.length > 0) {
        resolvedChild = children[0];
        await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, resolvedChild.id);
      }

      let activePersonalisation: ChildPersonalisation | null = null;
      if (resolvedChild) {
        try {
          activePersonalisation = await fetchPersonalisation(
            session.access_token,
            resolvedChild.id
          );
        } catch {
          activePersonalisation = null;
        }
      }

      set({
        children,
        activeChildId: resolvedChild?.id || null,
        activeChild: resolvedChild,
        activePersonalisation,
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
        let household: HouseholdInfo | null = null;
        try {
          const meta = sessionData.session.user?.user_metadata;
          const hName =
            meta?.household_name ||
            (meta?.full_name ? `${meta.full_name}'s Family` : 'Family Household');
          household = await ensureHousehold(token, hName);
        } catch (e) {
          console.warn('[AuthStore] ensureHousehold on init:', e);
        }

        const storedChildId = await AsyncStorage.getItem(ACTIVE_CHILD_ID_KEY);
        let activeChild: ChildProfile | null = null;
        let activeChildId: string | null = storedChildId;
        let activePersonalisation: ChildPersonalisation | null = null;
        let childrenList: ChildProfile[] = [];

        try {
          childrenList = await fetchChildren(token);
          activeChild =
            childrenList.find((c) => c.id === storedChildId) || null;
          if (!activeChild && childrenList.length > 0) {
            activeChild = childrenList[0];
            activeChildId = activeChild.id;
            await AsyncStorage.setItem(ACTIVE_CHILD_ID_KEY, activeChild.id);
          }
          if (activeChild) {
            try {
              activePersonalisation = await fetchPersonalisation(
                token,
                activeChild.id
              );
            } catch {}
          }
        } catch {
          // Non-blocking
        }

        set({
          user: sessionData.session.user,
          session: sessionData.session,
          household,
          isGuest: false,
          children: childrenList,
          activeChildId,
          activeChild,
          activePersonalisation,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        // 2. Hydrate guest session token & status (browsing only, no anonymous chat)
        const storedToken = await getStoredGuestToken();
        let remaining = 0;

        try {
          const guestRes = await getGuestStatus();
          const activeToken =
            guestRes.token ||
            guestRes.guest?.token ||
            guestRes.guestSession?.token ||
            storedToken;
          remaining = guestRes.remaining ?? 0;

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
          children: [],
          activeChildId: null,
          activeChild: null,
          activePersonalisation: null,
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
              children: [],
              activeChildId: null,
              activeChild: null,
              activePersonalisation: null,
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

      let household: HouseholdInfo | null = null;
      try {
        const meta = data.session.user?.user_metadata;
        const hName =
          meta?.household_name ||
          (meta?.full_name ? `${meta.full_name}'s Family` : 'Family Household');
        household = await ensureHousehold(data.session.access_token, hName);
      } catch (e) {
        console.warn('[AuthStore] ensureHousehold on email sign in:', e);
      }

      set({
        user: data.session.user,
        session: data.session,
        household,
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
        let household: HouseholdInfo | null = null;
        try {
          const hName = householdName.trim() || 'Family Household';
          household = await ensureHousehold(data.session.access_token, hName);
        } catch (e) {
          console.warn('[AuthStore] ensureHousehold on email sign up:', e);
        }

        set({
          user: data.session.user,
          session: data.session,
          household,
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
        let household: HouseholdInfo | null = null;
        try {
          const meta = data.session.user?.user_metadata;
          const hName =
            meta?.household_name ||
            (meta?.full_name ? `${meta.full_name}'s Family` : 'Family Household');
          household = await ensureHousehold(data.session.access_token, hName);
        } catch (e) {
          console.warn('[AuthStore] ensureHousehold on Google sign in:', e);
        }

        set({
          user: data.session.user,
          session: data.session,
          household,
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
      await signOutGoogle();
      await clearStoredGuestToken();
      await AsyncStorage.removeItem(ACTIVE_CHILD_ID_KEY).catch(() => {});
      set({
        user: null,
        session: null,
        household: null,
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
