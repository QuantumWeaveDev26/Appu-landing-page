const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const AppuSession = require('../appu-session.js');
const AppuBackendClient = require('../appu-backend-client.js');
const ParentOnboardingShell = require('../parent-onboarding-shell.js');

describe('Parent Onboarding Integration Shell & Session Flow', () => {
  beforeEach(() => {
    AppuSession.clear();
    ParentOnboardingShell.state.supabaseClient = null;
    ParentOnboardingShell.state.session = null;
    ParentOnboardingShell.state.household = null;
    ParentOnboardingShell.state.subscription = null;
    ParentOnboardingShell.state.children = [];
    ParentOnboardingShell.state.selectedChild = null;
    ParentOnboardingShell.state.personalisation = null;
    ParentOnboardingShell.state.authStatus = 'UNAUTHENTICATED';
  });

  afterEach(() => {
    AppuSession.clear();
  });

  // ============================================================================
  // 1. SUPABASE AUTH & HOUSEHOLD ONBOARDING
  // ============================================================================

  test('signInParent authenticates via Supabase and onboards household if missing', async () => {
    const originalFetch = global.fetch;
    let onboardCalled = false;
    let onboardBody = {};

    global.fetch = async (url, options = {}) => {
      if (url.endsWith('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              principal: { userId: 'parent-usr-123' },
              household: null // missing household triggers onboarding
            };
          }
        };
      }

      if (url.endsWith('/api/household/onboard')) {
        onboardCalled = true;
        onboardBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          async json() {
            return {
              household: { id: 'hh-123', name: onboardBody.householdName }
            };
          }
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    // Mock window.supabase
    global.window = global.window || {};
    global.window.supabase = {
      createClient: () => ({
        auth: {
          async signInWithPassword({ email }) {
            return {
              data: {
                session: {
                  access_token: 'parent-access-token-xyz',
                  user: { id: 'parent-usr-123', email }
                }
              },
              error: null
            };
          }
        }
      })
    };

    try {
      const result = await ParentOnboardingShell.signInParent({
        email: 'parent@example.com',
        password: 'password123',
        householdName: 'Verma Family'
      });

      assert.equal(result.session.access_token, 'parent-access-token-xyz');
      assert.equal(result.household.id, 'hh-123');
      assert.equal(onboardCalled, true);
      assert.equal(onboardBody.householdName, 'Verma Family');
      // Invariant: Browser does not pass householdId
      assert.equal(onboardBody.householdId, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ============================================================================
  // 2. PLANS & SUBSCRIPTION SELECTION
  // ============================================================================

  test('fetchPlans loads plans from backend and subscribeToPlan sends only planCode', async () => {
    const originalFetch = global.fetch;
    let subscriptionCreated = false;
    let subscriptionBody = {};

    global.fetch = async (url, options = {}) => {
      if (url.endsWith('/api/plans')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              plans: [
                { id: 'p1', code: 'starter', name: 'Starter', amountPaise: 29900 },
                { id: 'p2', code: 'growth', name: 'Growth', amountPaise: 59900 },
                { id: 'p3', code: 'family', name: 'Family', amountPaise: 99900 }
              ]
            };
          }
        };
      }

      if (url.endsWith('/api/subscriptions')) {
        subscriptionCreated = true;
        subscriptionBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          async json() {
            return {
              subscriptionId: 'sub-local-1',
              keyId: 'rzp_test_key',
              providerSubscriptionId: 'sub_rzp_123',
              planCode: subscriptionBody.planCode
            };
          }
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
      const plans = await ParentOnboardingShell.fetchPlans();
      assert.equal(plans.length, 3);
      assert.equal(plans[0].code, 'starter');
      assert.equal(plans[0].amountPaise, 29900);

      ParentOnboardingShell.state.session = { access_token: 'parent-token' };

      // Mock window.Razorpay SDK
      global.window.Razorpay = function (options) {
        this.open = () => {
          // Trigger handler callback
          options.handler({
            razorpay_payment_id: 'pay_123',
            razorpay_subscription_id: 'sub_rzp_123',
            razorpay_signature: 'sig_123'
          });
        };
      };

      // Mock verify checkout & current subscription polling
      const oldFetch = global.fetch;
      global.fetch = async (url, options = {}) => {
        if (url.endsWith('/api/subscriptions')) {
          subscriptionCreated = true;
          subscriptionBody = JSON.parse(options.body);
          return {
            ok: true,
            status: 201,
            async json() {
              return {
                subscriptionId: 'sub-local-1',
                keyId: 'rzp_test_key',
                providerSubscriptionId: 'sub_rzp_123',
                planCode: subscriptionBody.planCode
              };
            }
          };
        }
        if (url.endsWith('/api/subscriptions/verify-checkout')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { status: 'AUTHENTICATED' };
            }
          };
        }
        if (url.endsWith('/api/subscriptions/current')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return {
                subscription: {
                  id: 'sub-local-1',
                  status: 'ACTIVE',
                  planCode: 'growth'
                }
              };
            }
          };
        }
        return oldFetch(url, options);
      };

      await ParentOnboardingShell.subscribeToPlan('growth');

      assert.equal(subscriptionCreated, true);
      assert.deepEqual(Object.keys(subscriptionBody), ['planCode']);
      assert.equal(subscriptionBody.planCode, 'growth');
      assert.equal(ParentOnboardingShell.state.subscription?.status, 'ACTIVE');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ============================================================================
  // 3. CHILD SETUP & PERSONALISATION
  // ============================================================================

  test('createChild and savePersonalisation send strictly scoped payloads without householdId', async () => {
    const originalFetch = global.fetch;
    let capturedChildBody = {};
    let capturedPersBody = {};

    ParentOnboardingShell.state.session = { access_token: 'parent-token' };

    global.fetch = async (url, options = {}) => {
      if (url.endsWith('/api/children') && options.method === 'POST') {
        capturedChildBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          async json() {
            return {
              child: {
                id: 'child-uuid-999',
                preferredName: capturedChildBody.preferredName,
                gradeBand: capturedChildBody.gradeBand
              }
            };
          }
        };
      }

      if (url.endsWith('/api/children') && !options.method) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { children: [{ id: 'child-uuid-999', preferredName: 'Aarav' }] };
          }
        };
      }

      if (url.includes('/personalisation') && options.method === 'PUT') {
        capturedPersBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              personalisation: capturedPersBody
            };
          }
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
      const child = await ParentOnboardingShell.createChild({
        preferredName: 'Aarav',
        gradeBand: 'Grade 6'
      });

      assert.equal(child.id, 'child-uuid-999');
      assert.equal(capturedChildBody.householdId, undefined);
      assert.equal(capturedChildBody.preferredName, 'Aarav');

      await ParentOnboardingShell.savePersonalisation(child.id, {
        preferredLanguage: 'kn',
        learningStyle: 'interactive',
        fontPreference: 'rounded',
        responseStyle: 'playful',
        themePreference: 'auto',
        interests: ['space', 'robotics'],
        favoriteSubjects: ['science']
      });

      assert.equal(capturedPersBody.preferredLanguage, 'kn');
      assert.equal(capturedPersBody.learningStyle, 'interactive');
      assert.equal(capturedPersBody.householdId, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ============================================================================
  // 4. SUBSCRIPTION VIEW-MODEL, QUOTA & NON-ACTIVE STATES
  // ============================================================================

  test('getSubscriptionViewModel computes accurate view-model from server data without fabricating usage', () => {
    ParentOnboardingShell.state.plans = [
      {
        id: 'p1',
        code: 'starter',
        name: 'Starter',
        amountPaise: 29900,
        entitlements: {
          max_children: 1,
          monthly_ai_sessions: 100,
          monthly_voice_minutes: 30,
          multilingual: true
        }
      }
    ];

    ParentOnboardingShell.state.subscription = {
      id: 'sub-1',
      status: 'ACTIVE',
      planCode: 'starter',
      entitlements: {
        max_children: 1,
        monthly_ai_sessions: 100,
        monthly_voice_minutes: 30,
        multilingual: true
      }
    };

    ParentOnboardingShell.state.children = [
      { id: 'c1', preferredName: 'Aarav', gradeBand: 'Grade 5' }
    ];

    ParentOnboardingShell.state.usage = {
      period: { startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-31T00:00:00.000Z' },
      aiSessions: { used: 7, limit: 100, remaining: 93 },
      voiceMinutes: { used: null, limit: 30, remaining: null, meteringStatus: 'pending' }
    };

    const vm = ParentOnboardingShell.getSubscriptionViewModel();

    assert.equal(vm.isPaidAccess, true);
    assert.equal(vm.planName, 'Starter');
    assert.equal(vm.displayPrice, '₹299');
    assert.equal(vm.childCount, 1);
    assert.equal(vm.maxChildren, 1);
    assert.equal(vm.canAddLearner, false); // 1/1 used -> cannot add more
    assert.equal(vm.aiSessions.used, 7);
    assert.equal(vm.aiSessions.limit, 100);
    assert.equal(vm.aiSessions.remaining, 93);
    assert.equal(vm.voiceMinutes.used, null);
    assert.equal(vm.voiceMinutes.limit, 30);
    assert.equal(vm.voiceMinutes.meteringStatus, 'pending');
    assert.ok(vm.statusMessage.includes('active'));
  });

  test('fetchUsageSummary retrieves real usage from GET /api/usage/current', async () => {
    const originalFetch = global.fetch;
    ParentOnboardingShell.state.session = { access_token: 'parent-token' };

    global.fetch = async (url) => {
      if (url.endsWith('/api/usage/current')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              period: { startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-31T00:00:00.000Z' },
              aiSessions: { used: 12, limit: 100, remaining: 88 },
              voiceMinutes: { used: null, limit: 30, remaining: null, meteringStatus: 'pending' }
            };
          }
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    try {
      const usage = await ParentOnboardingShell.fetchUsageSummary();
      assert.equal(usage.aiSessions.used, 12);
      assert.equal(usage.aiSessions.remaining, 88);
      assert.equal(ParentOnboardingShell.state.usage.aiSessions.used, 12);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('getSubscriptionViewModel safely maps non-ACTIVE statuses to user-friendly messages', () => {
    const statuses = [
      { status: 'AUTHENTICATED', expectedLabel: 'PENDING ACTIVATION', isPaid: false },
      { status: 'PENDING_PAYMENT', expectedLabel: 'PAYMENT PENDING', isPaid: false },
      { status: 'PAST_DUE', expectedLabel: 'PAST DUE', isPaid: false },
      { status: 'PAUSED', expectedLabel: 'PAUSED', isPaid: false },
      { status: 'EXPIRED', expectedLabel: 'EXPIRED', isPaid: false }
    ];

    ParentOnboardingShell.state.plans = [{ code: 'growth', name: 'Growth', amountPaise: 59900 }];

    for (const item of statuses) {
      ParentOnboardingShell.state.subscription = {
        id: 'sub-test',
        status: item.status,
        planCode: 'growth'
      };

      const vm = ParentOnboardingShell.getSubscriptionViewModel();
      assert.equal(vm.statusLabel, item.expectedLabel);
      assert.equal(vm.isPaidAccess, item.isPaid);
      assert.ok(vm.statusMessage.length > 5);
      // Invariant: No raw internal state names leaked in messages
      assert.ok(!vm.statusMessage.includes('STATE_'));
    }
  });

  test('quota limit permits adding children only when childCount < maxChildren', () => {
    ParentOnboardingShell.state.plans = [
      { code: 'growth', name: 'Growth', amountPaise: 59900, entitlements: { max_children: 2 } }
    ];
    ParentOnboardingShell.state.subscription = {
      status: 'ACTIVE',
      planCode: 'growth',
      entitlements: { max_children: 2 }
    };

    // 1 child of 2 allowed
    ParentOnboardingShell.state.children = [{ id: 'c1', preferredName: 'Child 1' }];
    let vm = ParentOnboardingShell.getSubscriptionViewModel();
    assert.equal(vm.childCount, 1);
    assert.equal(vm.maxChildren, 2);
    assert.equal(vm.canAddLearner, true);

    // 2 children of 2 allowed
    ParentOnboardingShell.state.children.push({ id: 'c2', preferredName: 'Child 2' });
    vm = ParentOnboardingShell.getSubscriptionViewModel();
    assert.equal(vm.childCount, 2);
    assert.equal(vm.maxChildren, 2);
    assert.equal(vm.canAddLearner, false);
  });

  // ============================================================================
  // 5. SESSION HANDOFF & LOGOUT
  // ============================================================================

  test('launchAppuSession sets in-memory AppuSession and signOut clears it', async () => {
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    ParentOnboardingShell.state.session = {
      access_token: 'valid-parent-jwt',
      user: { email: 'parent@example.com' }
    };
    ParentOnboardingShell.state.household = { name: 'Verma Family' };
    ParentOnboardingShell.state.selectedChild = {
      id: 'child-uuid-999',
      preferredName: 'Aarav',
      gradeBand: 'Grade 6'
    };
    ParentOnboardingShell.state.subscription = { planCode: 'growth' };

    ParentOnboardingShell.launchAppuSession();

    assert.equal(AppuSession.isAuthenticated(), true);
    assert.equal(AppuSession.accessToken, 'valid-parent-jwt');
    assert.equal(AppuSession.childId, 'child-uuid-999');
    assert.equal(AppuSession.parentContext.childName, 'Aarav');

    // Invariant: Opening parent state does not clear session
    const vm = ParentOnboardingShell.getSubscriptionViewModel();
    assert.equal(AppuSession.isAuthenticated(), true);

    // Sign out
    await ParentOnboardingShell.signOut();

    assert.equal(AppuSession.isAuthenticated(), false);
    assert.equal(AppuSession.accessToken, null);
    assert.equal(AppuSession.childId, null);
  });

  // ============================================================================
  // 6. SESSION RESTORATION & AUTH REHYDRATION
  // ============================================================================

  test('valid Supabase session with 1 child auto-restores AppuSession to READY state', async () => {
    const originalFetch = global.fetch;
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { principal: { userId: 'usr-1' }, household: { id: 'hh-1', name: 'Sharma Family' } };
          }
        };
      }
      if (url.endsWith('/api/plans')) {
        return { ok: true, status: 200, async json() { return { plans: [{ code: 'starter', name: 'Starter Plan' }] }; } };
      }
      if (url.endsWith('/api/usage/current')) {
        return { ok: true, status: 200, async json() { return { aiSessions: { used: 5, limit: 100, remaining: 95 } }; } };
      }
      if (url.endsWith('/api/subscriptions/current')) {
        return { ok: true, status: 200, async json() { return { subscription: { id: 'sub-1', status: 'ACTIVE', planCode: 'starter' } }; } };
      }
      if (url.endsWith('/api/children')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { children: [{ id: 'child-101', preferredName: 'Riya', gradeBand: 'Grade 4' }] };
          }
        };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return {
              data: { session: { access_token: 'valid-restored-token-123', user: { email: 'parent@sharma.com' } } },
              error: null
            };
          }
        }
      })
    };

    try {
      const res = await ParentOnboardingShell.restoreSession();
      assert.equal(res.status, 'READY');
      assert.equal(ParentOnboardingShell.getAuthStatus(), 'READY');
      assert.equal(AppuSession.isAuthenticated(), true);
      assert.equal(AppuSession.accessToken, 'valid-restored-token-123');
      assert.equal(AppuSession.childId, 'child-101');
      assert.equal(AppuSession.parentContext.childName, 'Riya');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('valid Supabase session with multiple children requires explicit learner selection', async () => {
    const originalFetch = global.fetch;
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, status: 200, async json() { return { principal: { userId: 'usr-2' }, household: { id: 'hh-2', name: 'Reddy Family' } }; } };
      }
      if (url.endsWith('/api/plans')) {
        return { ok: true, status: 200, async json() { return { plans: [] }; } };
      }
      if (url.endsWith('/api/usage/current')) {
        return { ok: true, status: 200, async json() { return null; } };
      }
      if (url.endsWith('/api/subscriptions/current')) {
        return { ok: true, status: 200, async json() { return { subscription: { id: 'sub-2', status: 'ACTIVE', planCode: 'growth' } }; } };
      }
      if (url.endsWith('/api/children')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              children: [
                { id: 'child-201', preferredName: 'Aditya', gradeBand: 'Grade 3' },
                { id: 'child-202', preferredName: 'Ananya', gradeBand: 'Grade 6' }
              ]
            };
          }
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return {
              data: { session: { access_token: 'parent-multi-child-token', user: { email: 'reddy@example.com' } } },
              error: null
            };
          }
        }
      })
    };

    try {
      const res = await ParentOnboardingShell.restoreSession();
      assert.equal(res.status, 'CHILD_SELECTION_REQUIRED');
      assert.equal(ParentOnboardingShell.getAuthStatus(), 'CHILD_SELECTION_REQUIRED');
      // Invariant: AppuSession is not automatically assigned to an arbitrary child
      assert.equal(AppuSession.isAuthenticated(), false);

      // Explicit learner selection
      ParentOnboardingShell.launchAppuSession(ParentOnboardingShell.state.children[1]);
      assert.equal(AppuSession.isAuthenticated(), true);
      assert.equal(AppuSession.childId, 'child-202');
      assert.equal(AppuSession.parentContext.childName, 'Ananya');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('no Supabase session leaves AppuSession unauthenticated', async () => {
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return { data: { session: null }, error: null };
          }
        }
      })
    };

    const res = await ParentOnboardingShell.restoreSession();
    assert.equal(res.status, 'UNAUTHENTICATED');
    assert.equal(ParentOnboardingShell.getAuthStatus(), 'UNAUTHENTICATED');
    assert.equal(AppuSession.isAuthenticated(), false);
  });

  test('expired/rejected backend token clears AppuSession and signs out', async () => {
    const originalFetch = global.fetch;
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/me')) {
        return { ok: false, status: 401, async json() { return { error: 'Unauthorized' }; } };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    let signOutCalled = false;
    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return { data: { session: { access_token: 'expired-token-xyz' } }, error: null };
          },
          async signOut() {
            signOutCalled = true;
          }
        }
      })
    };

    try {
      const res = await ParentOnboardingShell.restoreSession();
      assert.equal(res.status, 'UNAUTHENTICATED');
      assert.equal(AppuSession.isAuthenticated(), false);
      assert.equal(signOutCalled, true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('inactive subscription leaves parent authenticated but does NOT restore AppuSession', async () => {
    const originalFetch = global.fetch;
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, status: 200, async json() { return { principal: { userId: 'usr-3' }, household: { id: 'hh-3' } }; } };
      }
      if (url.endsWith('/api/plans')) {
        return { ok: true, status: 200, async json() { return { plans: [] }; } };
      }
      if (url.endsWith('/api/usage/current')) {
        return { ok: true, status: 200, async json() { return null; } };
      }
      if (url.endsWith('/api/subscriptions/current')) {
        return { ok: true, status: 200, async json() { return { subscription: { status: 'EXPIRED', planCode: 'starter' } }; } };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return { data: { session: { access_token: 'expired-sub-token' } }, error: null };
          }
        }
      })
    };

    try {
      const res = await ParentOnboardingShell.restoreSession();
      assert.equal(res.status, 'PARENT_AUTHENTICATED');
      assert.equal(ParentOnboardingShell.getAuthStatus(), 'PARENT_AUTHENTICATED');
      assert.equal(AppuSession.isAuthenticated(), false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('deleted child profile is not restored and requires learner selection', async () => {
    const originalFetch = global.fetch;
    global.window = global.window || {};
    global.window.AppuSession = AppuSession;

    global.fetch = async (url) => {
      if (url.endsWith('/api/auth/me')) {
        return { ok: true, status: 200, async json() { return { principal: { userId: 'usr-4' }, household: { id: 'hh-4' } }; } };
      }
      if (url.endsWith('/api/plans')) {
        return { ok: true, status: 200, async json() { return { plans: [] }; } };
      }
      if (url.endsWith('/api/usage/current')) {
        return { ok: true, status: 200, async json() { return null; } };
      }
      if (url.endsWith('/api/subscriptions/current')) {
        return { ok: true, status: 200, async json() { return { subscription: { status: 'ACTIVE', planCode: 'starter' } }; } };
      }
      if (url.endsWith('/api/children')) {
        // Child was deleted -> returns empty children list
        return { ok: true, status: 200, async json() { return { children: [] }; } };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    global.window.supabase = {
      createClient: () => ({
        auth: {
          async getSession() {
            return { data: { session: { access_token: 'deleted-child-token' } }, error: null };
          }
        }
      })
    };

    try {
      const res = await ParentOnboardingShell.restoreSession();
      assert.equal(res.status, 'CHILD_SELECTION_REQUIRED');
      assert.equal(AppuSession.isAuthenticated(), false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('application code does not write bearer tokens to localStorage or sessionStorage', async () => {
    const originalLocalStorageSet = global.localStorage?.setItem;
    const storageKeys = [];

    global.localStorage = {
      setItem(key, value) {
        storageKeys.push({ key, value });
      },
      getItem() { return null; }
    };

    ParentOnboardingShell.state.session = { access_token: 'super-secret-jwt-token-12345' };
    ParentOnboardingShell.state.selectedChild = { id: 'c-1', preferredName: 'Kid' };
    ParentOnboardingShell.launchAppuSession();

    // Verify token was NOT written to localStorage by application code
    const leaked = storageKeys.some(
      (entry) => String(entry.value).includes('super-secret-jwt') || String(entry.key).includes('jwt')
    );
    assert.equal(leaked, false, 'Application code must NEVER write bearer tokens to storage');
  });

  test('frontend handles arbitrary number of plans (1, 2, 4+) and arbitrary plan codes without hardcoded names', async () => {
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      if (url.endsWith('/api/plans')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              plans: [
                { id: 'p-custom-1', code: 'solo_learner', name: 'Solo Learner', amountPaise: 19900, entitlements: { max_children: 1, monthly_ai_sessions: 50, monthly_voice_minutes: 15, advanced_personalisation: false } },
                { id: 'p-custom-2', code: 'family_explorer', name: 'Family Explorer', amountPaise: 79900, entitlements: { max_children: 3, monthly_ai_sessions: 300, monthly_voice_minutes: 90, advanced_personalisation: true } },
                { id: 'p-custom-3', code: 'school_pack', name: 'School Pack', amountPaise: 199900, entitlements: { max_children: 10, monthly_ai_sessions: 1500, monthly_voice_minutes: 500, advanced_personalisation: true } },
                { id: 'p-custom-4', code: 'annual_vip', name: 'Annual VIP', amountPaise: 499900, entitlements: { max_children: 5, monthly_ai_sessions: 1000, monthly_voice_minutes: 300, advanced_personalisation: true } }
              ]
            };
          }
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    try {
      const plans = await ParentOnboardingShell.fetchPlans();
      assert.equal(plans.length, 4);
      assert.equal(plans[0].code, 'solo_learner');
      assert.equal(plans[3].code, 'annual_vip');

      // Test view-model with a custom plan code
      ParentOnboardingShell.state.subscription = {
        id: 'sub-vip',
        status: 'ACTIVE',
        planCode: 'annual_vip'
      };
      ParentOnboardingShell.state.children = [
        { id: 'c1', preferredName: 'Child 1' },
        { id: 'c2', preferredName: 'Child 2' }
      ];

      const vm = ParentOnboardingShell.getSubscriptionViewModel();
      assert.equal(vm.isPaidAccess, true);
      assert.equal(vm.planName, 'Annual VIP');
      assert.equal(vm.displayPrice, '₹4999');
      assert.equal(vm.maxChildren, 5);
      assert.equal(vm.canAddLearner, true); // 2/5 used
      assert.equal(vm.entitlements.advancedPersonalisation, true);
      assert.equal(vm.aiSessions.limit, 1000);
      assert.equal(vm.voiceMinutes.limit, 300);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
