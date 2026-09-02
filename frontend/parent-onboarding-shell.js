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
    return 'https://api.appuai.online';
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
  let _authListenerClient = null;
  let _authListenerSubscription = null;
  let _interactiveAuthPending = false;
  let _lastSynchronizedAccessToken = null;
  let _authEventChain = Promise.resolve();
  let _authGeneration = 0;

  function beginAuthTransition() {
    state.authStatus = 'AUTH_CHECKING';
    _readyPromise = new Promise((resolve) => {
      _resolveReady = resolve;
    });
    notifyAuthStateChanged();
  }

  function finishAuthTransition(status) {
    state.authStatus = status;
    notifyAuthStateChanged();
    if (_resolveReady) {
      _resolveReady(status);
      _resolveReady = null;
    }
  }

  function whenReady() {
    return state.authStatus === 'AUTH_CHECKING' && _readyPromise
      ? _readyPromise
      : Promise.resolve(state.authStatus);
  }

  function clearAuthenticatedRuntimeState() {
    state.session = null;
    state.household = null;
    state.subscription = null;
    state.usage = null;
    state.children = [];
    state.selectedChild = null;
    state.personalisation = null;
    _lastSynchronizedAccessToken = null;

    if (typeof window !== 'undefined' && window.AppuSession && typeof window.AppuSession.clear === 'function') {
      window.AppuSession.clear();
    }
  }

  function notifyAuthStateChanged() {
    updateHeaderSessionBadge();

    if (typeof window === 'undefined' || !window.app) return;
    if (typeof window.app.updateGuestBadge === 'function') {
      window.app.updateGuestBadge();
    }
    if (state.session && typeof window.app.closeGuestGateModal === 'function') {
      window.app.closeGuestGateModal();
    }
  }

  function enqueueAuthSynchronization(session, options) {
    const operation = _authEventChain.then(() => synchronizeAuthenticatedSession(session, options));
    _authEventChain = operation.catch(() => {});
    return operation;
  }

  function handleSupabaseAuthEvent(event, session) {
    if (event === 'SIGNED_OUT') {
      _authGeneration += 1;
      clearAuthenticatedRuntimeState();
      finishAuthTransition('UNAUTHENTICATED');
      return;
    }

    if (event === 'SIGNED_IN') {
      if (_interactiveAuthPending || !session?.access_token) return;
      if (session.access_token === _lastSynchronizedAccessToken && state.authStatus !== 'AUTH_CHECKING') return;
      const generation = ++_authGeneration;
      beginAuthTransition();
      void enqueueAuthSynchronization(session, { source: 'SIGNED_IN', transitionStarted: true, generation }).catch(() => {});
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session?.access_token) {
      const generation = ++_authGeneration;
      beginAuthTransition();
      void enqueueAuthSynchronization(session, { source: 'TOKEN_REFRESHED', force: true, transitionStarted: true, generation }).catch(() => {});
    }
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
          detectSessionInUrl: true
        }
      });

      if (
        state.supabaseClient.auth &&
        typeof state.supabaseClient.auth.onAuthStateChange === 'function' &&
        _authListenerClient !== state.supabaseClient
      ) {
        if (_authListenerSubscription && typeof _authListenerSubscription.unsubscribe === 'function') {
          _authListenerSubscription.unsubscribe();
        }
        const listener = state.supabaseClient.auth.onAuthStateChange((event, session) => {
          // Keep this callback synchronous. Backend synchronization runs on the auth event queue.
          handleSupabaseAuthEvent(event, session);
        });
        _authListenerClient = state.supabaseClient;
        _authListenerSubscription = listener?.data?.subscription || null;
      }
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
    const generation = ++_authGeneration;
    _interactiveAuthPending = true;
    try {
      if (isSignUp) {
        const emailRedirectTo = typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://appuai.online';
        authRes = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo }
        });
      } else {
        authRes = await supabase.auth.signInWithPassword({ email, password });
      }

      if (authRes.error) {
        throw new Error(authRes.error.message || 'Authentication failed');
      }

      if (!authRes.data || !authRes.data.session) {
        return {
          status: 'VERIFICATION_REQUIRED',
          needsVerification: true,
          email,
          user: authRes.data?.user || null,
          message: `We sent a verification link to ${email}. Open your inbox and click the link to verify your account.`
        };
      }

      const result = await synchronizeAuthenticatedSession(authRes.data.session, {
        source: 'INTERACTIVE_SIGN_IN',
        allowHouseholdOnboarding: true,
        householdName,
        force: true,
        generation
      });
      if (result.status === 'UNAUTHENTICATED') {
        throw new Error('Failed to verify parent identity with backend');
      }
      return result;
    } finally {
      _interactiveAuthPending = false;
    }
  }

  /**
   * Resends email verification for signup.
   */
  async function resendVerificationEmail(email) {
    const supabase = initSupabase();
    if (!supabase?.auth || typeof supabase.auth.resend !== 'function') {
      throw new Error('Verification resend is not supported by auth client');
    }
    const emailRedirectTo = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://appuai.online';
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: (email || '').trim(),
      options: { emailRedirectTo }
    });
    if (error) {
      throw new Error(error.message || 'Failed to resend verification email');
    }
    return { success: true };
  }

  /**
   * Manually checks whether an email verification session has been established.
   */
  async function checkEmailVerificationSession({ householdName = 'Family' } = {}) {
    const supabase = initSupabase();
    if (!supabase?.auth || typeof supabase.auth.getSession !== 'function') {
      return { status: 'UNAUTHENTICATED', reason: 'supabase_unavailable' };
    }
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) {
      return { status: 'UNAUTHENTICATED', reason: 'no_session' };
    }
    const generation = ++_authGeneration;
    return synchronizeAuthenticatedSession(data.session, {
      source: 'VERIFICATION_CHECK',
      force: true,
      allowHouseholdOnboarding: true,
      householdName,
      generation
    });
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

    notifyAuthStateChanged();
  }

  /**
   * Shared post-auth synchronization for interactive sign-in, persisted-session restore,
   * and Supabase auth events. The backend remains authoritative for household,
   * subscription, usage, learner, and personalisation state.
   */
  async function synchronizeAuthenticatedSession(session, options = {}) {
    const token = session?.access_token;
    const generation = options.generation ?? ++_authGeneration;
    const isSuperseded = () => generation !== _authGeneration;
    const supersededResult = () => {
      if (!state.session) clearAuthenticatedRuntimeState();
      return { status: state.authStatus, reason: 'superseded' };
    };
    if (isSuperseded()) return supersededResult();
    if (!token) {
      clearAuthenticatedRuntimeState();
      finishAuthTransition('UNAUTHENTICATED');
      return { status: 'UNAUTHENTICATED', reason: 'no_session' };
    }

    if (!options.force && token === _lastSynchronizedAccessToken && state.authStatus !== 'AUTH_CHECKING') {
      return {
        status: state.authStatus,
        synchronized: true,
        session: state.session,
        household: state.household,
        child: state.selectedChild
      };
    }

    if (!options.transitionStarted) {
      beginAuthTransition();
    }
    clearAuthenticatedRuntimeState();
    state.session = session;

    try {
      const meRes = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (isSuperseded()) return supersededResult();

      if (!meRes.ok) {
        const supabase = state.supabaseClient;
        clearAuthenticatedRuntimeState();
        finishAuthTransition('UNAUTHENTICATED');
        if (supabase?.auth && typeof supabase.auth.signOut === 'function') {
          await supabase.auth.signOut().catch(() => {});
        }
        return { status: 'UNAUTHENTICATED', reason: 'auth_rejected' };
      }

      const meData = await meRes.json();
      if (isSuperseded()) return supersededResult();
      state.household = meData.household || null;

      if (!state.household && options.allowHouseholdOnboarding) {
        const onboardRes = await fetch(`${getApiBaseUrl()}/api/household/onboard`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ householdName: options.householdName || 'Family Household' })
        });
        if (isSuperseded()) return supersededResult();
        if (!onboardRes.ok) {
          throw new Error('Failed to create household');
        }
        const onboardData = await onboardRes.json();
        state.household = onboardData.household;
      }

      if (!state.household) {
        _lastSynchronizedAccessToken = token;
        finishAuthTransition('PARENT_AUTHENTICATED');
        return {
          status: 'PARENT_AUTHENTICATED',
          synchronized: true,
          session: state.session,
          household: null,
          reason: 'no_household'
        };
      }

      await Promise.all([
        fetchPlans().catch(() => []),
        fetchUsageSummary().catch(() => null)
      ]);
      if (isSuperseded()) return supersededResult();

      const sub = await fetchCurrentSubscription().catch(() => null);
      if (isSuperseded()) return supersededResult();
      if (!sub || sub.status !== 'ACTIVE') {
        _lastSynchronizedAccessToken = token;
        finishAuthTransition('PARENT_AUTHENTICATED');
        return {
          status: 'PARENT_AUTHENTICATED',
          synchronized: true,
          session: state.session,
          household: state.household,
          subscription: sub,
          reason: 'subscription_inactive'
        };
      }

      const children = await fetchChildren().catch(() => []);
      if (isSuperseded()) return supersededResult();
      if (children.length === 1) {
        state.selectedChild = children[0];
        await fetchPersonalisation(state.selectedChild.id).catch(() => null);
        if (isSuperseded()) return supersededResult();
        launchAppuSession(state.selectedChild);
        _lastSynchronizedAccessToken = token;
        finishAuthTransition('READY');
        return {
          status: 'READY',
          synchronized: true,
          session: state.session,
          household: state.household,
          subscription: state.subscription,
          child: state.selectedChild
        };
      }

      state.selectedChild = null;
      _lastSynchronizedAccessToken = token;
      finishAuthTransition('CHILD_SELECTION_REQUIRED');
      return {
        status: 'CHILD_SELECTION_REQUIRED',
        synchronized: true,
        session: state.session,
        household: state.household,
        subscription: state.subscription,
        children
      };
    } catch (err) {
      if (isSuperseded()) return supersededResult();
      clearAuthenticatedRuntimeState();
      finishAuthTransition('UNAUTHENTICATED');
      return { status: 'UNAUTHENTICATED', reason: 'exception', error: err?.message };
    }
  }

  /**
   * Restores the persisted Supabase session, then delegates to the shared post-auth path.
   */
  async function restoreSession() {
    const generation = ++_authGeneration;
    beginAuthTransition();
    const supabase = initSupabase();
    if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== 'function') {
      clearAuthenticatedRuntimeState();
      finishAuthTransition('UNAUTHENTICATED');
      return { status: 'UNAUTHENTICATED', reason: 'supabase_unavailable' };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session?.access_token) {
        clearAuthenticatedRuntimeState();
        finishAuthTransition('UNAUTHENTICATED');
        return { status: 'UNAUTHENTICATED', reason: 'no_session' };
      }
      // allowHouseholdOnboarding: a household is 1:1 with a verified account in this app --
      // there is no separate "create household" UI, so any authenticated session missing
      // one (fresh signup, or a session restored before onboarding completed) should get
      // one lazily here rather than surfacing "no active household" downstream.
      return synchronizeAuthenticatedSession(data.session, { source: 'INITIAL_SESSION', force: true, transitionStarted: true, allowHouseholdOnboarding: true, generation });
    } catch (err) {
      clearAuthenticatedRuntimeState();
      finishAuthTransition('UNAUTHENTICATED');
      return { status: 'UNAUTHENTICATED', reason: 'exception', error: err?.message };
    }
  }

  function getAuthStatus() {
    return state.authStatus;
  }

  function isParentAuthenticated() {
    return Boolean(state.session?.access_token && state.authStatus !== 'UNAUTHENTICATED');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

    function wireLogout(el) {
      if (!el) return;
      const btn = el.querySelector('#btn-session-logout');
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          signOut();
        };
      }
    }

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
      const childName = state.selectedChild?.preferredName || state.selectedChild?.name || pContext.childName || 'Learner';
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-graduation-cap text-cyan"></i><span>Learning: <strong>${escapeHtml(childName)}</strong></span><button id="btn-session-logout" class="badge-logout-btn" title="Sign out" aria-label="Sign out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>`;
        wireLogout(badge);
      }
      if (parentSetupBtn) {
        parentSetupBtn.innerHTML = `<i class="fa-solid fa-sliders"></i><span>Parent Zone</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = `Appu ready for ${childName}`;
      }
    } else if (state.session && (state.authStatus === 'CHILD_SELECTION_REQUIRED' || (state.children && state.children.length > 1))) {
      const displayName = state.household?.name || (state.session.user?.email ? state.session.user.email.split('@')[0] : 'Parent');
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-users text-cyan"></i><span>${escapeHtml(displayName)} • <strong>Select Learner</strong></span><button id="btn-session-logout" class="badge-logout-btn" title="Sign out" aria-label="Sign out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>`;
        wireLogout(badge);
      }
      if (parentSetupBtn) {
        parentSetupBtn.innerHTML = `<i class="fa-solid fa-sliders"></i><span>Parent Zone</span>`;
      }
      if (statusLabel) {
        statusLabel.textContent = 'Please select a learner';
      }
    } else if (state.session && state.authStatus !== 'UNAUTHENTICATED') {
      // Authenticated parent immediately after login or without active learner
      const displayName = state.household?.name || (state.session.user?.email ? state.session.user.email.split('@')[0] : 'Parent');
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.innerHTML = `<i class="fa-solid fa-user-check text-cyan"></i><span>Signed in: <strong>${escapeHtml(displayName)}</strong></span><button id="btn-session-logout" class="badge-logout-btn" title="Sign out" aria-label="Sign out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>`;
        wireLogout(badge);
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
    _authGeneration += 1;
    const supabase = initSupabase();
    if (supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
      await supabase.auth.signOut().catch(() => {});
    }
    clearAuthenticatedRuntimeState();
    finishAuthTransition('UNAUTHENTICATED');
  }

  return {
    state,
    initSupabase,
    signInParent,
    synchronizeAuthenticatedSession,
    restoreSession,
    whenReady,
    getAuthStatus,
    isParentAuthenticated,
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
    resendVerificationEmail,
    checkEmailVerificationSession,
    signOut,
    getApiBaseUrl
  };
});
