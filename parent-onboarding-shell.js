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
    usage: null,
    plans: [],
    children: [],
    selectedChild: null,
    personalisation: null,
    currentStep: 1,
    authStatus: 'UNAUTHENTICATED' // 'AUTH_CHECKING' | 'UNAUTHENTICATED' | 'PARENT_AUTHENTICATED' | 'CHILD_SELECTION_REQUIRED' | 'READY'
  };

  let _readyPromise = null;
  let _resolveReady = null;

  function initReadyPromise() {
    if (!_readyPromise) {
      _readyPromise = new Promise((resolve) => {
        _resolveReady = resolve;
      });
    }
  }

  initReadyPromise();

  function whenReady() {
    if (!_readyPromise) {
      return Promise.resolve(state.authStatus);
    }
    return _readyPromise;
  }

  /**
   * Builds resolved frontend view-model for subscription, plans, usage accounting, and learner quotas.
   * STRICT INVARIANT: Backend data is the single source of truth.
   */
  function getSubscriptionViewModel() {
    const sub = state.subscription;
    const plans = state.plans || [];
    const children = state.children || [];
    const activeChild = state.selectedChild || (children.length > 0 ? children[0] : null);

    const currentPlan = sub ? plans.find((p) => p.code === sub.planCode) : null;
    const maxChildren = sub?.entitlements?.max_children || currentPlan?.entitlements?.max_children || 1;
    const childCount = children.length;
    const canAddLearner = childCount < maxChildren;

    const planAiLimit = currentPlan?.entitlements?.monthly_ai_sessions ?? 100;
    const planVoiceLimit = currentPlan?.entitlements?.monthly_voice_minutes ?? 30;

    const aiUsed = state.usage?.aiSessions?.used ?? 0;
    const aiLimit = state.usage?.aiSessions?.limit ?? planAiLimit;
    const aiRemaining = state.usage?.aiSessions?.remaining ?? Math.max(0, aiLimit - aiUsed);

    // Safe, user-friendly state mappings
    const statusMap = {
      ACTIVE: { label: 'ACTIVE', message: 'Your plan is active and ready for learning.', badgeClass: 'active', isPaidAccess: true },
      AUTHENTICATED: { label: 'PENDING ACTIVATION', message: 'Payment verified. Waiting for activation confirmation.', badgeClass: 'pending', isPaidAccess: false },
      PENDING_PAYMENT: { label: 'PAYMENT PENDING', message: 'Complete payment to activate Appu.', badgeClass: 'pending', isPaidAccess: false },
      PAST_DUE: { label: 'PAST DUE', message: 'Payment needs attention. Please renew your plan.', badgeClass: 'warning', isPaidAccess: false },
      PAUSED: { label: 'PAUSED', message: 'Your subscription is currently paused.', badgeClass: 'paused', isPaidAccess: false },
      HALTED: { label: 'HALTED', message: 'Your subscription has been halted.', badgeClass: 'error', isPaidAccess: false },
      CANCELLED: { label: 'CANCELLED', message: 'Your subscription was cancelled.', badgeClass: 'error', isPaidAccess: false },
      EXPIRED: { label: 'EXPIRED', message: 'Your subscription has expired.', badgeClass: 'error', isPaidAccess: false }
    };

    const statusInfo = (sub && statusMap[sub.status]) || {
      label: 'NO PLAN',
      message: 'Choose a plan to activate personalized Appu learning.',
      badgeClass: 'none',
      isPaidAccess: false
    };

    return {
      hasSubscription: Boolean(sub),
      isPaidAccess: statusInfo.isPaidAccess,
      status: sub ? sub.status : null,
      statusLabel: statusInfo.label,
      statusMessage: statusInfo.message,
      statusBadgeClass: statusInfo.badgeClass,
      planCode: sub ? sub.planCode : null,
      planName: currentPlan ? currentPlan.name : (sub ? sub.planCode.toUpperCase() : 'Free Guest'),
      displayPrice: currentPlan ? `₹${Math.round(currentPlan.amountPaise / 100)}` : '₹0',
      billingInterval: 'month',
      maxChildren,
      childCount,
      canAddLearner,
      remainingLearners: Math.max(0, maxChildren - childCount),
      aiSessions: {
        used: aiUsed,
        limit: aiLimit,
        remaining: aiRemaining
      },
      voiceMinutes: {
        used: state.usage?.voiceMinutes?.used !== undefined ? state.usage.voiceMinutes.used : 0,
        limit: state.usage?.voiceMinutes?.limit ?? planVoiceLimit,
        remaining: state.usage?.voiceMinutes?.remaining !== undefined ? state.usage.voiceMinutes.remaining : planVoiceLimit,
        meteringStatus: state.usage?.voiceMinutes?.meteringStatus ?? 'active'
      },
      usagePeriod: state.usage?.period ?? null,
      entitlements: {
        maxChildren,
        monthlyAiSessions: planAiLimit,
        monthlyVoiceMinutes: planVoiceLimit,
        multilingual: currentPlan?.entitlements?.multilingual ?? true,
        advancedPersonalisation: Boolean(currentPlan?.entitlements?.advanced_personalisation),
        parentReports: Boolean(currentPlan?.entitlements?.parent_reports)
      },
      activeChild,
      children
    };
  }

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
   * Groups plan variants into primary product tiers with monthly & annual options.
   */
  function groupPlansByTier(plans = state.plans || []) {
    const defaultTiers = [
      {
        tierCode: 'free',
        tierName: 'APPU Free',
        description: 'Basic AI discovery and essential learning for every student.',
        isRecommended: false,
        isPrimaryCard: true,
        isFree: true,
        monthly: null,
        annual: null
      },
      {
        tierCode: 'evolve',
        tierName: 'APPU Evolve',
        description: 'Persistent learner profile, adaptive learning paths, storytelling, and weekly missions.',
        isRecommended: false,
        isPrimaryCard: true,
        monthly: null,
        annual: null
      },
      {
        tierCode: 'evolve_plus',
        tierName: 'APPU Evolve+',
        description: 'Advanced personalisation, strength identification, gap detection, goal journeys, and parent insights.',
        isRecommended: true,
        isPrimaryCard: true,
        monthly: null,
        annual: null
      },
      {
        tierCode: 'signature',
        tierName: 'APPU Signature',
        description: 'Bespoke institutional learning architecture, custom curricula, and high-touch private cohorts.',
        isRecommended: false,
        isPrimaryCard: true,
        isSignature: true,
        monthly: null,
        annual: null
      },
      {
        tierCode: 'genesis',
        tierName: 'APPU Genesis',
        description: 'Complete multimodal cognitive architecture with bespoke learning DNA and continuous coaching.',
        isRecommended: false,
        isPrimaryCard: false,
        monthly: null,
        annual: null
      }
    ];

    const tierMap = {};
    defaultTiers.forEach((t) => {
      tierMap[t.tierCode] = { ...t };
    });

    const orderedCodes = ['free', 'evolve', 'evolve_plus', 'signature', 'genesis'];

    plans.forEach((p) => {
      const code = p.code || '';
      let tierCode = p.tierCode || code.replace(/_(monthly|annual)$/, '');
      if (!tierMap[tierCode]) {
        tierMap[tierCode] = {
          tierCode,
          tierName: p.tierName || p.name,
          description: p.description || '',
          isRecommended: Boolean(p.isRecommended),
          isPrimaryCard: p.isPrimaryCard !== false,
          monthly: null,
          annual: null
        };
        orderedCodes.push(tierCode);
      }

      const tier = tierMap[tierCode];
      if (p.isRecommended) tier.isRecommended = true;
      if (p.description && !tier.description) tier.description = p.description;

      if (p.billingInterval === 'yearly' || code.endsWith('_annual')) {
        tier.annual = p;
      } else if (p.billingInterval === 'monthly' || code.endsWith('_monthly')) {
        tier.monthly = p;
      } else if (tierCode === 'free') {
        tier.monthly = p;
        tier.annual = p;
      } else if (tierCode === 'signature') {
        if (p.billingInterval === 'yearly') tier.annual = p;
        else tier.monthly = p;
      }
    });

    return orderedCodes
      .filter((tc) => Boolean(tierMap[tc]))
      .map((tc) => tierMap[tc]);
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
   * Fetches authoritative usage summary from GET /api/usage/current.
   */
  async function fetchUsageSummary() {
    if (!state.session?.access_token) {
      return null;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/usage/current`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    state.usage = data || null;
    return state.usage;
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

    const subData = await subRes.json();
    const { keyId, providerSubscriptionId, subscriptionId, isFree } = subData;

    // 1. FREE tier or provider-free subscription activates immediately without Razorpay modal
    if (isFree || !providerSubscriptionId) {
      if (onStatusUpdate) onStatusUpdate('Activating your companion plan...');
      await fetchCurrentSubscription();
      await fetchUsageSummary();
      return state.subscription;
    }

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
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySubscriptionId: response.razorpay_subscription_id || providerSubscriptionId,
                razorpaySignature: response.razorpay_signature
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
    state.selectedChild = targetChild;
    state.authStatus = 'READY';

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
          planCode: state.subscription?.planCode || state.plans?.[0]?.code || 'active_plan'
        }
      });
    }

    updateHeaderSessionBadge();
  }

  /**
   * Session Restoration / Auth Rehydration Boot Flow:
   * 
   * 1. Query official Supabase client for current persisted session.
   * 2. If unauthenticated -> clear session and remain in UNAUTHENTICATED mode.
   * 3. If session present:
   *    a. Confirm identity and household via GET /api/auth/me.
   *    b. Confirm active subscription via GET /api/subscriptions/current.
   *    c. Fetch children via GET /api/children.
   *    d. If exactly 1 child: safely auto-restore AppuSession and transition to READY.
   *    e. If multiple children: transition to CHILD_SELECTION_REQUIRED (requires explicit learner selection).
   *    f. If 0 children: transition to CHILD_SELECTION_REQUIRED (prompt child setup).
   */
  async function restoreSession() {
    state.authStatus = 'AUTH_CHECKING';
    initReadyPromise();
    updateHeaderSessionBadge();

    const supabase = initSupabase();
    if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== 'function') {
      state.authStatus = 'UNAUTHENTICATED';
      updateHeaderSessionBadge();
      if (_resolveReady) _resolveReady(state.authStatus);
      return { status: 'UNAUTHENTICATED', reason: 'supabase_unavailable' };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session || !data.session.access_token) {
        state.session = null;
        state.authStatus = 'UNAUTHENTICATED';
        if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
          window.AppuSession.clear();
        }
        updateHeaderSessionBadge();
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'UNAUTHENTICATED', reason: 'no_session' };
      }

      state.session = data.session;
      const token = state.session.access_token;

      // 1. Verify parent identity and household membership: GET /api/auth/me
      const meRes = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!meRes.ok) {
        // Expired, revoked, or invalid token
        await signOut().catch(() => {});
        state.authStatus = 'UNAUTHENTICATED';
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'UNAUTHENTICATED', reason: 'auth_rejected' };
      }

      const meData = await meRes.json();
      if (!meData.household) {
        state.household = null;
        state.authStatus = 'PARENT_AUTHENTICATED';
        updateHeaderSessionBadge();
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'PARENT_AUTHENTICATED', reason: 'no_household' };
      }
      state.household = meData.household;

      // 2. Fetch plans & usage summary in parallel
      await Promise.all([
        fetchPlans().catch(() => []),
        fetchUsageSummary().catch(() => null)
      ]);

      // 3. Confirm active subscription: GET /api/subscriptions/current
      const sub = await fetchCurrentSubscription().catch(() => null);
      if (!sub || sub.status !== 'ACTIVE') {
        state.authStatus = 'PARENT_AUTHENTICATED';
        if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
          window.AppuSession.clear();
        }
        updateHeaderSessionBadge();
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'PARENT_AUTHENTICATED', subscription: sub, reason: 'subscription_inactive' };
      }

      // 4. Fetch child profiles: GET /api/children
      const children = await fetchChildren().catch(() => []);

      if (children.length === 1) {
        // Exactly 1 child -> safely auto-restore learner context
        state.selectedChild = children[0];
        launchAppuSession(state.selectedChild);
        state.authStatus = 'READY';
        updateHeaderSessionBadge();
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'READY', child: state.selectedChild };
      }

      if (children.length > 1) {
        // Multiple children -> require explicit learner selection before AppuSession becomes active
        state.selectedChild = null;
        if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
          window.AppuSession.clear();
        }
        state.authStatus = 'CHILD_SELECTION_REQUIRED';
        updateHeaderSessionBadge();
        if (_resolveReady) _resolveReady(state.authStatus);
        return { status: 'CHILD_SELECTION_REQUIRED', children };
      }

      // 0 children
      state.selectedChild = null;
      if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
        window.AppuSession.clear();
      }
      state.authStatus = 'CHILD_SELECTION_REQUIRED';
      updateHeaderSessionBadge();
      if (_resolveReady) _resolveReady(state.authStatus);
      return { status: 'CHILD_SELECTION_REQUIRED', children: [] };
    } catch (err) {
      state.authStatus = 'UNAUTHENTICATED';
      if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
        window.AppuSession.clear();
      }
      updateHeaderSessionBadge();
      if (_resolveReady) _resolveReady(state.authStatus);
      return { status: 'UNAUTHENTICATED', reason: 'exception', error: err?.message };
    }
  }

  function getAuthStatus() {
    return state.authStatus;
  }

  /**
   * Updates UI header badge reflecting active authenticated session.
   */
  function updateHeaderSessionBadge() {
    if (typeof document === 'undefined') return;

    const badge = document.getElementById('parent-session-badge');
    const parentSetupBtn = document.getElementById('btn-parent-setup');
    const statusLabel = document.getElementById('status-label');

    const isChecking = state.authStatus === 'AUTH_CHECKING';
    const isAuthed =
      typeof window !== 'undefined' &&
      window.AppuSession &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();

    if (isChecking) {
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-cyan"></i><span>Restoring session…</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = 'Restoring your Appu session…';
      }
      return;
    }

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
    } else if (state.session && state.authStatus === 'CHILD_SELECTION_REQUIRED') {
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-users text-cyan"></i><span>Select Learner</span><button id="btn-session-logout" class="badge-logout-btn" title="Sign out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>`;
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
        statusLabel.textContent = 'Please select a learner';
      }
    } else if (state.session && state.authStatus === 'PARENT_AUTHENTICATED') {
      if (badge) {
        badge.style.display = 'none';
        badge.innerHTML = '';
      }
      if (parentSetupBtn) {
        parentSetupBtn.innerHTML = `<i class="fa-solid fa-sliders"></i><span>Parent Zone</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = 'Appu is ready';
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
    state.usage = null;
    state.children = [];
    state.selectedChild = null;
    state.personalisation = null;
    state.authStatus = 'UNAUTHENTICATED';

    if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
      window.AppuSession.clear();
    }

    updateHeaderSessionBadge();
  }

  return {
    state,
    initSupabase,
    signInParent,
    restoreSession,
    whenReady,
    getAuthStatus,
    fetchPlans,
    groupPlansByTier,
    fetchCurrentSubscription,
    fetchUsageSummary,
    getSubscriptionViewModel,
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
