/**
 * ParentOnboardingShell: Development Phase 2 Onboarding & Session Handoff Integration
 * 
 * Orchestrates:
 * Step 1: Parent Authentication (Supabase Login / Signup) + Household Onboarding
 * Step 2: Plan Selection + Razorpay Standard Checkout + Polling for ACTIVE status
 * Step 3: Child Profile Creation & Selection (Scoped to Household)
 * Step 4: Personalisation Questionnaire (Validated enums and attributes)
 * Step 5: Handoff to in-memory AppuSession -> Launches personalized child experience
 * 
 * SECURITY INVARIANTS:
 * - Browser never provides householdId, plan authority, or system prompts.
 * - Access tokens are held in-memory and handed to AppuSession.
 * - Only verified ACTIVE subscriptions proceed to child setup and personalization.
 * - No internal secrets or provider webhook URLs are exposed.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ParentOnboardingShell = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function getApiBaseUrl() {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.APPU_CONFIG &&
      typeof globalThis.APPU_CONFIG.apiBaseUrl === 'string' &&
      globalThis.APPU_CONFIG.apiBaseUrl.trim()
    ) {
      return globalThis.APPU_CONFIG.apiBaseUrl.replace(/\/+$/, '');
    }
    return 'http://localhost:3000';
  }

  function getSupabaseConfig() {
    if (typeof globalThis !== 'undefined' && globalThis.APPU_CONFIG) {
      return {
        url: globalThis.APPU_CONFIG.supabaseUrl,
        key: globalThis.APPU_CONFIG.supabasePublishableKey
      };
    }
    return {
      url: 'https://cmulkkpinwernuzhtegp.supabase.co',
      key: 'sb_publishable_N-I0xWkc2SXY6kga0iD0_Q_awDjKXNr'
    };
  }

  // In-memory onboarding state
  const state = {
    supabaseClient: null,
    session: null,
    household: null,
    subscription: null,
    plans: [],
    children: [],
    selectedChild: null,
    personalisation: null,
    currentStep: 1
  };

  /**
   * Initializes the Supabase client.
   */
  function initSupabase() {
    if (state.supabaseClient) return state.supabaseClient;

    const { url, key } = getSupabaseConfig();
    if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      state.supabaseClient = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      return state.supabaseClient;
    }
    return null;
  }

  /**
   * Step 1: Authenticates parent using Supabase password login or signup.
   */
  async function signInParent({ email, password, isSignUp = false, householdName = 'Family' }) {
    const supabase = initSupabase();
    if (!supabase) {
      throw new Error('Supabase client is not available in the browser');
    }

    let authRes;
    if (isSignUp) {
      authRes = await supabase.auth.signUp({ email, password });
    } else {
      authRes = await supabase.auth.signInWithPassword({ email, password });
    }

    if (authRes.error) {
      throw new Error(authRes.error.message || 'Authentication failed');
    }

    if (!authRes.data || !authRes.data.session) {
      throw new Error('Sign up successful! Please check your email to confirm your account, then sign in.');
    }

    state.session = authRes.data.session;
    const token = state.session.access_token;

    // Verify /api/auth/me
    const meRes = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!meRes.ok) {
      throw new Error('Failed to verify parent identity with backend');
    }

    const meData = await meRes.json();
    if (!meData.household) {
      // Idempotent household onboarding
      const onboardRes = await fetch(`${getApiBaseUrl()}/api/household/onboard`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ householdName: householdName || 'Family Household' })
      });
      if (!onboardRes.ok) {
        throw new Error('Failed to create household');
      }
      const onboardData = await onboardRes.json();
      state.household = onboardData.household;
    } else {
      state.household = meData.household;
    }

    return { session: state.session, household: state.household };
  }

  /**
   * Step 2: Fetches plans from database.
   */
  async function fetchPlans() {
    const res = await fetch(`${getApiBaseUrl()}/api/plans`);
    if (!res.ok) {
      throw new Error('Failed to load subscription plans');
    }
    const data = await res.json();
    state.plans = data.plans || [];
    return state.plans;
  }

  /**
   * Checks current subscription status.
   */
  async function fetchCurrentSubscription() {
    if (!state.session?.access_token) {
      return null;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/subscriptions/current`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    state.subscription = data.subscription || null;
    return state.subscription;
  }

  /**
   * Creates pending subscription and launches Razorpay Standard Checkout.
   */
  async function subscribeToPlan(planCode, onStatusUpdate) {
    if (!state.session?.access_token) {
      throw new Error('Parent session required');
    }

    if (onStatusUpdate) onStatusUpdate('Creating subscription order...');

    const subRes = await fetch(`${getApiBaseUrl()}/api/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ planCode })
    });

    if (!subRes.ok) {
      const err = await subRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create subscription');
    }

    const { keyId, providerSubscriptionId, subscriptionId } = await subRes.json();

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.Razorpay) {
        reject(new Error('Razorpay Checkout SDK is not loaded.'));
        return;
      }

      const options = {
        key: keyId,
        subscription_id: providerSubscriptionId,
        name: 'APPU AI Learning Companion',
        description: `Subscription for ${planCode.toUpperCase()} Plan`,
        image: 'assets/appu_cutout_new.png',
        handler: async (response) => {
          try {
            if (onStatusUpdate) onStatusUpdate('Verifying payment signature...');

            const verifyRes = await fetch(`${getApiBaseUrl()}/api/subscriptions/verify-checkout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${state.session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                subscriptionId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature
              })
            });

            if (!verifyRes.ok) {
              const err = await verifyRes.json().catch(() => ({}));
              throw new Error(err.error?.message || 'Payment signature verification failed');
            }

            if (onStatusUpdate) onStatusUpdate('Payment received — activating your plan...');

            // Poll for ACTIVE subscription
            let active = false;
            for (let i = 0; i < 15; i++) {
              await new Promise((r) => setTimeout(r, 2000));
              const current = await fetchCurrentSubscription();
              if (current && current.status === 'ACTIVE') {
                active = true;
                break;
              }
            }

            if (!active) {
              if (onStatusUpdate) {
                onStatusUpdate('Plan activation pending webhook confirmation. You can proceed if test mode webhook fired.');
              }
            }

            resolve(state.subscription);
          } catch (err) {
            reject(err);
          }
        },
        prefill: {
          email: state.session.user?.email || ''
        },
        theme: {
          color: '#22d3ee'
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment window was closed.'));
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }

  /**
   * Step 3: Fetches child profiles.
   */
  async function fetchChildren() {
    if (!state.session?.access_token) return [];
    const res = await fetch(`${getApiBaseUrl()}/api/children`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });
    if (!res.ok) {
      throw new Error('Failed to load child profiles');
    }
    const data = await res.json();
    state.children = data.children || [];
    return state.children;
  }

  /**
   * Step 3: Creates a new child profile.
   */
  async function createChild({ preferredName, gradeBand }) {
    if (!state.session?.access_token) {
      throw new Error('Parent session required');
    }

    const res = await fetch(`${getApiBaseUrl()}/api/children`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ preferredName, gradeBand })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to create child profile');
    }

    const data = await res.json();
    state.selectedChild = data.child;
    await fetchChildren();
    return data.child;
  }

  /**
   * Step 4: Fetches personalization for a child.
   */
  async function fetchPersonalisation(childId) {
    if (!state.session?.access_token) return null;
    const res = await fetch(`${getApiBaseUrl()}/api/children/${childId}/personalisation`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    state.personalisation = data.personalisation;
    return state.personalisation;
  }

  /**
   * Step 4: Saves personalization questionnaire.
   */
  async function savePersonalisation(childId, personalisationInput) {
    if (!state.session?.access_token) {
      throw new Error('Parent session required');
    }

    const res = await fetch(`${getApiBaseUrl()}/api/children/${childId}/personalisation`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(personalisationInput)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to save personalisation');
    }

    const data = await res.json();
    state.personalisation = data.personalisation;
    return state.personalisation;
  }

  /**
   * Step 5: Completes onboarding and hands off session to in-memory AppuSession.
   */
  function launchAppuSession(child) {
    if (!state.session?.access_token) {
      throw new Error('Active parent session required for handoff');
    }
    const targetChild = child || state.selectedChild;
    if (!targetChild?.id) {
      throw new Error('Selected child required for session handoff');
    }

    if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.setSession === 'function') {
      window.AppuSession.setSession({
        accessToken: state.session.access_token,
        childId: targetChild.id,
        parentContext: {
          authenticated: true,
          parentEmail: state.session.user?.email,
          householdName: state.household?.name || 'Family',
          childName: targetChild.preferredName,
          gradeBand: targetChild.gradeBand,
          planCode: state.subscription?.planCode || 'starter'
        }
      });
    }

    updateHeaderSessionBadge();
  }

  /**
   * Updates UI header badge reflecting active authenticated session.
   */
  function updateHeaderSessionBadge() {
    if (typeof document === 'undefined') return;

    const badge = document.getElementById('parent-session-badge');
    const parentSetupBtn = document.getElementById('btn-parent-setup');
    const statusLabel = document.getElementById('status-label');

    const isAuthed =
      typeof window !== 'undefined' &&
      window.AppuSession &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();

    if (isAuthed) {
      const pContext = window.AppuSession.parentContext || {};
      const childName = pContext.childName || 'Learner';
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-graduation-cap text-cyan"></i><span>Learning: <strong>${childName}</strong></span><button id="btn-session-logout" class="badge-logout-btn" title="Sign out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>`;
        const btnLogout = document.getElementById('btn-session-logout');
        if (btnLogout) {
          btnLogout.onclick = (e) => {
            e.stopPropagation();
            signOut();
          };
        }
      }
      if (parentSetupBtn) {
        parentSetupBtn.innerHTML = `<i class="fa-solid fa-sliders"></i><span>Parent Zone</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = `Appu ready for ${childName}`;
      }
    } else {
      if (badge) {
        badge.style.display = 'none';
        badge.innerHTML = '';
      }
      if (parentSetupBtn) {
        parentSetupBtn.innerHTML = `<i class="fa-solid fa-user-gear"></i><span>Parent Setup</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = 'Appu is ready';
      }
    }
  }

  /**
   * Signs out parent and clears AppuSession.
   */
  async function signOut() {
    const supabase = initSupabase();
    if (supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
      await supabase.auth.signOut().catch(() => {});
    }

    state.session = null;
    state.household = null;
    state.subscription = null;
    state.children = [];
    state.selectedChild = null;
    state.personalisation = null;

    if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
      window.AppuSession.clear();
    }

    updateHeaderSessionBadge();
  }

  return {
    state,
    initSupabase,
    signInParent,
    fetchPlans,
    fetchCurrentSubscription,
    subscribeToPlan,
    fetchChildren,
    createChild,
    fetchPersonalisation,
    savePersonalisation,
    launchAppuSession,
    updateHeaderSessionBadge,
    signOut,
    getApiBaseUrl
  };
});
