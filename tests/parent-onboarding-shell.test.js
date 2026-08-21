const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const AppuSession = require('../appu-session.js');
const AppuBackendClient = require('../appu-backend-client.js');
const ParentOnboardingShell = require('../parent-onboarding-shell.js');

describe('Parent Onboarding Integration Shell & Session Flow', () => {
  beforeEach(() => {
    AppuSession.clear();
    ParentOnboardingShell.state.session = null;
    ParentOnboardingShell.state.household = null;
    ParentOnboardingShell.state.subscription = null;
    ParentOnboardingShell.state.children = [];
    ParentOnboardingShell.state.selectedChild = null;
    ParentOnboardingShell.state.personalisation = null;
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
  // 4. SESSION HANDOFF & LOGOUT
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

    // Sign out
    await ParentOnboardingShell.signOut();

    assert.equal(AppuSession.isAuthenticated(), false);
    assert.equal(AppuSession.accessToken, null);
    assert.equal(AppuSession.childId, null);
  });
});
