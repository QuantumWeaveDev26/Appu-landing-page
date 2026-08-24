import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { MockAuthVerifier } from '../src/domain/auth/index.js';
import { MockRazorpayClient } from '../src/domain/razorpay/index.js';
import { SubscriptionService } from '../src/domain/subscription/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionStates } from '../src/domain/subscription/types.js';

function createTestDatabase(): TransactionalQueryable {
  const memDb = newDb();

  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: memDb.public.getType('uuid'),
    impure: true,
    implementation: () => crypto.randomUUID()
  });

  memDb.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [memDb.public.getType('int')],
    returns: memDb.public.getType('bool'),
    impure: true,
    implementation: () => true
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const db: TransactionalQueryable = {
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await pool.query<T>(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount
      };
    },

    async transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const transactionDb: Queryable = {
        async query<TResult = any>(queryText: string, values: any[] = []) {
          const result = await client.query<TResult>(queryText, values);
          return {
            rows: result.rows as TResult[],
            rowCount: result.rowCount
          };
        }
      };

      try {
        await client.query('BEGIN');
        const result = await work(transactionDb);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };

  return db;
}

describe('Milestone 3: Plans, Subscription Persistence & Razorpay TEST Integration', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    // Sync plans with mock provider IDs by default for route tests
    await SubscriptionService.syncPlans(db, {
      evolve_monthly: 'plan_rzp_evolve_mo_test',
      evolve_annual: 'plan_rzp_evolve_yr_test',
      evolve_plus_monthly: 'plan_rzp_evolve_plus_mo_test',
      evolve_plus_annual: 'plan_rzp_evolve_plus_yr_test',
      genesis_monthly: 'plan_rzp_genesis_mo_test',
      genesis_annual: 'plan_rzp_genesis_yr_test'
    });

    authVerifier = new MockAuthVerifier();
    razorpayClient = new MockRazorpayClient();

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      RAZORPAY_KEY_ID: 'rzp_test_mockKeyId',
      RAZORPAY_KEY_SECRET: 'mock_secret_key',
      RAZORPAY_WEBHOOK_SECRET: 'mock_webhook_secret',
      RAZORPAY_PLAN_MAPPINGS: JSON.stringify({
        evolve_monthly: 'plan_rzp_evolve_mo_test',
        evolve_annual: 'plan_rzp_evolve_yr_test',
        evolve_plus_monthly: 'plan_rzp_evolve_plus_mo_test',
        evolve_plus_annual: 'plan_rzp_evolve_plus_yr_test',
        genesis_monthly: 'plan_rzp_genesis_mo_test',
        genesis_annual: 'plan_rzp_genesis_yr_test'
      })
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // ============================================================================
  // 1. PUBLIC PLANS API & APPROVED STUDENT CATALOGUE
  // ============================================================================

  test('GET /api/plans returns approved student catalogue with tier metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/plans'
    });

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.payload);
    assert.ok(Array.isArray(payload.plans));
    assert.equal(payload.plans.length, 8);

    const free = payload.plans.find((p: any) => p.code === 'free');
    assert.ok(free);
    assert.equal(free.amountPaise, 0);
    assert.equal(free.displayPrice, '₹0');
    assert.equal(free.entitlements.max_children, undefined, 'max_children must not be exposed in public API');
    assert.equal(free.entitlements.monthly_ai_sessions, 20);

    const evolveMo = payload.plans.find((p: any) => p.code === 'evolve_monthly');
    assert.ok(evolveMo);
    assert.equal(evolveMo.amountPaise, 49900, 'Evolve Monthly must be ₹499');
    assert.equal(evolveMo.displayPrice, '₹499/mo');
    assert.equal(evolveMo.entitlements.max_children, undefined, 'max_children must not be exposed in public API');
    assert.equal(evolveMo.entitlements.monthly_ai_sessions, 150);

    // Verify every single public plan has max_children stripped
    payload.plans.forEach((p: any) => {
      assert.equal(p.entitlements?.max_children, undefined, `Plan ${p.code} must not expose max_children in public API`);
    });

    const evolveYr = payload.plans.find((p: any) => p.code === 'evolve_annual');
    assert.ok(evolveYr);
    assert.equal(evolveYr.amountPaise, 499900, 'Evolve Annual must be ₹4,999');
    assert.equal(evolveYr.displayPrice, '₹4,999/yr');
    assert.equal(evolveYr.annualSavingsPaise, 98900);

    const evolvePlusYr = payload.plans.find((p: any) => p.code === 'evolve_plus_annual');
    assert.ok(evolvePlusYr);
    assert.equal(evolvePlusYr.amountPaise, 999900);
    assert.equal(evolvePlusYr.isRecommended, true);

    const sig = payload.plans.find((p: any) => p.code === 'signature');
    assert.ok(sig);
    assert.equal(sig.checkoutEnabled, false);
  });

  // ============================================================================
  // 2. PLAN SYNCHRONIZATION SERVICE & CLI LOGIC
  // ============================================================================

  test('SubscriptionService.syncPlans maps student plans and is idempotent', async () => {
    const freshDb = createTestDatabase();
    await runMigrations(freshDb);

    // Initial state: provider_plan_id is null from migration
    const beforePlans = await SubscriptionRepository.listActivePlans(freshDb);
    const paidPlans = beforePlans.filter((p) => p.checkoutEnabled && p.amountPaise > 0);
    assert.equal(paidPlans.every((p) => p.providerPlanId === null), true);

    // 1. First sync run
    const result1 = await SubscriptionService.syncPlans(freshDb, {
      evolve_monthly: 'plan_evolve_custom_1',
      evolve_annual: 'plan_evolve_custom_2',
      evolve_plus_monthly: 'plan_evolve_plus_custom_3',
      evolve_plus_annual: 'plan_evolve_plus_custom_4',
      genesis_monthly: 'plan_genesis_custom_5',
      genesis_annual: 'plan_genesis_custom_6'
    });

    assert.equal(result1.syncedCount, 6);
    assert.deepEqual(result1.updatedPlans.sort(), [
      'evolve_annual',
      'evolve_monthly',
      'evolve_plus_annual',
      'evolve_plus_monthly',
      'genesis_annual',
      'genesis_monthly'
    ].sort());

    const afterPlans1 = await SubscriptionRepository.listActivePlans(freshDb);
    const evolve1 = afterPlans1.find((p) => p.code === 'evolve_monthly');
    assert.equal(evolve1?.providerPlanId, 'plan_evolve_custom_1');

    // 2. Second sync run (idempotent update)
    const result2 = await SubscriptionService.syncPlans(freshDb, {
      evolve_monthly: 'plan_evolve_custom_1',
      evolve_annual: 'plan_evolve_custom_2',
      evolve_plus_monthly: 'plan_evolve_plus_custom_3',
      evolve_plus_annual: 'plan_evolve_plus_custom_4',
      genesis_monthly: 'plan_genesis_custom_5',
      genesis_annual: 'plan_genesis_custom_6'
    });
    assert.equal(result2.syncedCount, 6);
  });

  test('SubscriptionService.syncPlans fails safely when required plan IDs are missing', async () => {
    const freshDb = createTestDatabase();
    await runMigrations(freshDb);

    await assert.rejects(
      async () => {
        await SubscriptionService.syncPlans(freshDb, {
          evolve_monthly: 'plan_evolve_only'
        });
      },
      (err: any) => {
        return (
          err.message.includes('evolve_annual') &&
          err.message.includes('missing provider plan ID')
        );
      }
    );
  });

  test('subscription creation rejects plan with missing provider_plan_id', async () => {
    const unsyncedDb = createTestDatabase();
    await runMigrations(unsyncedDb);

    const unsyncedApp = buildApp(
      loadConfig({
        NODE_ENV: 'test',
        PORT: '3000',
        HOST: '127.0.0.1',
        LOG_LEVEL: 'silent',
        RAZORPAY_KEY_ID: 'rzp_test_key',
        RAZORPAY_KEY_SECRET: 'secret'
      }),
      {
        database: unsyncedDb,
        authVerifier,
        razorpayClient
      }
    );

    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-unsynced';
    authVerifier.registerToken(token, { userId: parentUserId });

    await unsyncedApp.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const res = await unsyncedApp.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });

    assert.equal(res.statusCode, 400);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'invalid_request');
    assert.ok(payload.error.message.includes('configured provider plan ID'));

    await unsyncedApp.close();
  });

  // ============================================================================
  // 3. SUBSCRIPTION CREATION FLOW
  // ============================================================================

  test('POST /api/subscriptions creates pending subscription and persists provider ID', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-sub';
    authVerifier.registerToken(token, { userId: parentUserId });

    // 1. Onboard household
    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: { householdName: 'Sub Test Household' }
    });

    // 2. Request Evolve Monthly plan subscription
    razorpayClient.nextSubscriptionId = 'sub_rzp_test_1001';
    const subRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });

    assert.equal(subRes.statusCode, 201);
    const subPayload = JSON.parse(subRes.payload);
    assert.ok(subPayload.subscriptionId);
    assert.equal(subPayload.providerSubscriptionId, 'sub_rzp_test_1001');
    assert.equal(subPayload.planCode, 'evolve_monthly');
    assert.equal(subPayload.amountPaise, 49900, 'Evolve monthly amount must be 49900 paise');
    assert.equal(subPayload.status, SubscriptionStates.PENDING_PAYMENT);

    // Verify DB record
    const dbSub = await db.query('SELECT * FROM subscriptions WHERE id = $1;', [
      subPayload.subscriptionId
    ]);
    assert.equal(dbSub.rows.length, 1);
    assert.equal(dbSub.rows[0].status, 'PENDING_PAYMENT');
    assert.equal(dbSub.rows[0].provider_subscription_id, 'sub_rzp_test_1001');
  });

  test('POST /api/subscriptions rejects unknown planCode', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-sub-invalid';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'non_existent_ultra_plan' }
    });

    assert.equal(subRes.statusCode, 400);
    const payload = JSON.parse(subRes.payload);
    assert.equal(payload.error.code, 'invalid_request');
  });

  // ============================================================================
  // 4. CHECKOUT VERIFICATION & SECURITY INVARIANTS
  // ============================================================================

  test('POST /api/subscriptions/verify-checkout verifies signature and transitions to AUTHENTICATED (never directly ACTIVE)', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-checkout';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    razorpayClient.nextSubscriptionId = 'sub_rzp_test_checkout_1';
    await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });

    // Compute valid checkout signature: HMAC_SHA256(paymentId + "|" + subscriptionId, secretKey)
    const paymentId = 'pay_test_99999';
    const subscriptionId = 'sub_rzp_test_checkout_1';
    const validSignature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|${subscriptionId}`)
      .digest('hex');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: subscriptionId,
        razorpaySignature: validSignature
      }
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyPayload = JSON.parse(verifyRes.payload);
    assert.equal(verifyPayload.verified, true);
    assert.equal(
      verifyPayload.status,
      'AUTHENTICATED',
      'Browser checkout verification must move to AUTHENTICATED, NOT directly to ACTIVE'
    );

    // Verify GET /api/subscriptions/current reports AUTHENTICATED and null entitlements (only ACTIVE grants entitlements)
    const currentRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(currentRes.statusCode, 200);
    const currentPayload = JSON.parse(currentRes.payload);
    assert.equal(currentPayload.subscription.status, 'AUTHENTICATED');
    assert.equal(currentPayload.entitlements, null, 'AUTHENTICATED status must not grant active entitlements');
  });

  test('POST /api/subscriptions/verify-checkout rejects invalid checkout signature', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-invalid-sig';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    razorpayClient.nextSubscriptionId = 'sub_rzp_test_invalid_sig';
    await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: 'pay_test_1',
        razorpaySubscriptionId: 'sub_rzp_test_invalid_sig',
        razorpaySignature: 'invalid_forged_signature_hex'
      }
    });

    assert.equal(verifyRes.statusCode, 400);
    const payload = JSON.parse(verifyRes.payload);
    assert.equal(payload.error.code, 'invalid_request');
  });

  // ============================================================================
  // 5. WEBHOOK VERIFICATION, IDEMPOTENCY & STATE TRANSITIONS
  // ============================================================================

  test('POST /api/webhooks/razorpay processes subscription.activated, transitions to ACTIVE and enables entitlements', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-webhook';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subProviderId = 'sub_rzp_webhook_act_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_plus_monthly' }
    });

    // Construct Razorpay subscription.activated webhook body
    const webhookEvent = {
      event: 'subscription.activated',
      event_id: 'evt_test_activated_101',
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400
          }
        }
      }
    };
    const rawBody = JSON.stringify(webhookEvent);
    const signature = crypto
      .createHmac('sha256', razorpayClient.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': 'evt_test_activated_101'
      },
      payload: rawBody
    });

    assert.equal(webhookRes.statusCode, 200);
    const webhookPayload = JSON.parse(webhookRes.payload);
    assert.equal(webhookPayload.received, true);
    assert.equal(webhookPayload.status, 'processed');

    // Verify GET /api/subscriptions/current now reports ACTIVE and grants Evolve+ entitlements
    const currentRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(currentRes.statusCode, 200);
    const currentPayload = JSON.parse(currentRes.payload);
    assert.equal(currentPayload.subscription.status, 'ACTIVE');
    assert.ok(currentPayload.entitlements);
    assert.equal(currentPayload.entitlements.max_children, 1);
    assert.equal(currentPayload.entitlements.monthly_voice_minutes, 120);
    assert.equal(currentPayload.entitlements.advanced_personalisation, true);
  });

  test('POST /api/webhooks/razorpay duplicate event is safely ignored (idempotency)', async () => {
    const webhookEvent = {
      event: 'subscription.charged',
      event_id: 'evt_test_duplicate_999',
      payload: {
        subscription: {
          entity: {
            id: 'sub_dummy_non_existent',
            status: 'active'
          }
        }
      }
    };
    const rawBody = JSON.stringify(webhookEvent);
    const signature = crypto
      .createHmac('sha256', razorpayClient.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // First delivery
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': 'evt_test_duplicate_999'
      },
      payload: rawBody
    });
    assert.equal(res1.statusCode, 200);
    assert.equal(JSON.parse(res1.payload).status, 'processed');

    // Duplicate delivery
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
        'x-razorpay-event-id': 'evt_test_duplicate_999'
      },
      payload: rawBody
    });
    assert.equal(res2.statusCode, 200);
    assert.equal(JSON.parse(res2.payload).status, 'already_processed');
  });

  test('POST /api/webhooks/razorpay rejects invalid webhook signature', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_forged_webhook_signature'
      },
      payload: JSON.stringify({ event: 'subscription.activated' })
    });

    assert.equal(res.statusCode, 401);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'unauthorized');
  });

  // ============================================================================
  // 6. CROSS-TENANT SUBSCRIPTION ISOLATION
  // ============================================================================

  test('ADVERSARIAL: Parent A cannot verify checkout or view subscription for Parent B household', async () => {
    // 1. Setup Tenant A
    const parentAId = crypto.randomUUID();
    const tokenA = 'token-parent-A-sub';
    authVerifier.registerToken(tokenA, { userId: parentAId });
    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { householdName: 'Household A' }
    });

    // 2. Setup Tenant B and create subscription
    const parentBId = crypto.randomUUID();
    const tokenB = 'token-parent-B-sub';
    authVerifier.registerToken(tokenB, { userId: parentBId });
    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { householdName: 'Household B' }
    });

    razorpayClient.nextSubscriptionId = 'sub_rzp_parent_B_exclusive';
    await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { planCode: 'evolve_monthly' }
    });

    // 3. Parent A attempts to verify checkout for Parent B's subscription
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update('pay_hack_1|sub_rzp_parent_B_exclusive')
      .digest('hex');

    const crossVerifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        razorpayPaymentId: 'pay_hack_1',
        razorpaySubscriptionId: 'sub_rzp_parent_B_exclusive',
        razorpaySignature: signature
      }
    });

    assert.equal(crossVerifyRes.statusCode, 404, 'Must return 404 NOT_FOUND for cross-household subscription');

    // 4. Parent A requests current subscription: receives hasSubscription: false
    const currentA = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${tokenA}` }
    });
    assert.equal(currentA.statusCode, 200);
    assert.equal(JSON.parse(currentA.payload).hasSubscription, false);
  });

  // ============================================================================
  // 7. DEV-ONLY CHECKOUT PAGE SERVING
  // ============================================================================

  test('GET /checkout-test.html returns 200 and text/html in development/test mode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/checkout-test.html'
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type']?.includes('text/html'));
    assert.ok(res.payload.includes('Appu Checkout Validation'));
  });

  test('GET /checkout-test.html returns 404 in production mode', async () => {
    const prodConfig = loadConfig({
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'silent',
      GUEST_SESSION_SECRET: 'test_prod_guest_secret_32_characters'
    });

    const prodApp = buildApp(prodConfig, {
      database: db,
      authVerifier,
      razorpayClient
    });

    const res = await prodApp.inject({
      method: 'GET',
      url: '/checkout-test.html'
    });

    assert.equal(res.statusCode, 404);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'not_found');

    await prodApp.close();
  });

  // ============================================================================
  // 8. CHECKOUT CONTRACT & WEBHOOK IDEMPOTENCY HARDENING (MISSIONS 1 & 2)
  // ============================================================================

  test('POST /api/subscriptions/verify-checkout accepts canonical Razorpay callback fields and is idempotent', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-checkout-canonical';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subProviderId = 'sub_rzp_test_canon_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });
    const localSubId = JSON.parse(createRes.payload).subscriptionId;

    const paymentId = 'pay_test_canon_999';
    const validSignature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|${subProviderId}`)
      .digest('hex');

    // Test Case 1: Canonical Razorpay SDK output keys (razorpay_payment_id, etc.)
    const verifyRes1 = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: subProviderId,
        razorpay_signature: validSignature
      }
    });
    assert.equal(verifyRes1.statusCode, 200);
    assert.equal(JSON.parse(verifyRes1.payload).verified, true);
    assert.equal(JSON.parse(verifyRes1.payload).status, 'AUTHENTICATED');

    // Test Case 2: Idempotent re-verification with local UUID lookup
    const verifyRes2 = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        paymentId: paymentId,
        subscriptionId: localSubId,
        signature: validSignature
      }
    });
    assert.equal(verifyRes2.statusCode, 200);
    assert.equal(JSON.parse(verifyRes2.payload).verified, true);
  });

  test('POST /api/subscriptions/verify-checkout rejects missing or empty fields', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-checkout-validation';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    // Missing signature
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: 'pay_123',
        razorpaySubscriptionId: 'sub_123'
      }
    });
    assert.equal(res1.statusCode, 400);

    // Missing payment ID
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpaySubscriptionId: 'sub_123',
        razorpaySignature: 'sig_123'
      }
    });
    assert.equal(res2.statusCode, 400);

    // Missing subscription ID
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'sig_123'
      }
    });
    assert.equal(res3.statusCode, 400);
  });

  test('POST /api/webhooks/razorpay handles ACTIVE -> ACTIVE idempotently without throwing', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-webhook-idempotent';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subProviderId = 'sub_rzp_idemp_active_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });

    // 1. First event: subscription.activated -> moves to ACTIVE
    const actBody = JSON.stringify({
      event: 'subscription.activated',
      event_id: 'evt_test_act_001',
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400
          }
        }
      }
    });
    const sig1 = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(actBody).digest('hex');

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig1, 'x-razorpay-event-id': 'evt_test_act_001' },
      payload: actBody
    });
    assert.equal(res1.statusCode, 200);

    // 2. Second event: subscription.charged (with target ACTIVE) arrives while subscription is ALREADY ACTIVE
    const chargeBody = JSON.stringify({
      event: 'subscription.charged',
      event_id: 'evt_test_charge_002',
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active',
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400
          }
        }
      }
    });
    const sig2 = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(chargeBody).digest('hex');

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig2, 'x-razorpay-event-id': 'evt_test_charge_002' },
      payload: chargeBody
    });
    assert.equal(res2.statusCode, 200);
    assert.equal(JSON.parse(res2.payload).status, 'processed');

    // 3. Third event: out-of-order subscription.authenticated must NOT downgrade ACTIVE state
    const authBody = JSON.stringify({
      event: 'subscription.authenticated',
      event_id: 'evt_test_auth_003',
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active'
          }
        }
      }
    });
    const sig3 = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(authBody).digest('hex');

    const res3 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig3, 'x-razorpay-event-id': 'evt_test_auth_003' },
      payload: authBody
    });
    assert.equal(res3.statusCode, 200);

    // Verify final state is still ACTIVE
    const currentRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(currentRes.statusCode, 200);
    assert.equal(JSON.parse(currentRes.payload).subscription.status, 'ACTIVE');
  });

  // ============================================================================
  // 9. REPLAY PROOF, RECONCILIATION & ATOMICITY TESTS (MISSIONS 1, 2, 3)
  // ============================================================================

  test('MISSION 1 PROOF: webhook replay with same event ID returns already_processed without mutating subscription', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-webhook-replay';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subProviderId = 'sub_rzp_replay_proof_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });
    const subId = JSON.parse(createRes.payload).subscriptionId;

    // Transition to AUTHENTICATED
    await db.query(`UPDATE subscriptions SET status = 'AUTHENTICATED' WHERE id = $1;`, [subId]);

    // Record an event as already processed
    const eventId = 'evt_razorpay_original_123';
    await SubscriptionRepository.recordPaymentEvent(db, {
      provider: 'razorpay',
      providerEventId: eventId,
      eventType: 'subscription.activated',
      subscriptionId: subId,
      providerSubscriptionId: subProviderId,
      status: 'PROCESSED'
    });

    // Replay the webhook with the exact same event ID
    const actBody = JSON.stringify({
      event: 'subscription.activated',
      event_id: eventId,
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active'
          }
        }
      }
    });
    const signature = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(actBody).digest('hex');

    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
      payload: actBody
    });

    assert.equal(replayRes.statusCode, 200);
    const body = JSON.parse(replayRes.payload);
    assert.equal(body.status, 'already_processed', 'Replay must be intercepted as already_processed');

    // Verify subscription status is STILL AUTHENTICATED (not promoted by replay)
    const dbSub = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(dbSub?.status, 'AUTHENTICATED', 'Replay cannot repair subscription stuck in AUTHENTICATED');
  });

  test('MISSION 2: SubscriptionService.reconcileSubscription safely activates AUTHENTICATED paid subscription against Razorpay', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-reconcile-test';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    // 1. Initial Free subscription
    const freeSub = await SubscriptionService.createSubscription(db, razorpayClient, {
      householdId,
      planCode: 'free'
    });
    assert.equal(freeSub.subscription.status, 'ACTIVE');

    // 2. Paid Evolve Monthly created and set to AUTHENTICATED
    const subProviderId = 'sub_rzp_reconcile_active_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    const paidOrder = await SubscriptionService.createSubscription(db, razorpayClient, {
      householdId,
      planCode: 'evolve_monthly'
    });
    await db.query(`UPDATE subscriptions SET status = 'AUTHENTICATED' WHERE id = $1;`, [paidOrder.subscription.id]);

    // Mock Razorpay authoritative subscription state: ACTIVE with period timestamps
    const periodStart = Math.floor(Date.now() / 1000);
    const periodEnd = periodStart + 30 * 86400;
    razorpayClient.subscriptionStore.set(subProviderId, {
      id: subProviderId,
      planId: 'plan_evolve_monthly',
      status: 'active',
      currentStart: periodStart,
      currentEnd: periodEnd
    });

    // 3. Run reconciliation
    const result = await SubscriptionService.reconcileSubscription(db, razorpayClient, {
      providerSubscriptionId: subProviderId
    });

    assert.equal(result.reconciled, true);
    assert.equal(result.actionTaken, 'activated');
    assert.equal(result.providerStatus, 'active');
    assert.equal(result.previousStatus, 'AUTHENTICATED');
    assert.equal(result.currentStatus, 'ACTIVE');

    // Verify DB state
    const currentSub = await SubscriptionRepository.getLatestSubscriptionForHousehold(db, householdId);
    assert.equal(currentSub?.status, 'ACTIVE');
    assert.equal(currentSub?.planCode, 'evolve_monthly');
    assert.equal(currentSub?.providerSubscriptionId, subProviderId);

    // Verify old Free subscription was expired
    const oldFree = await SubscriptionRepository.getSubscriptionById(db, freeSub.subscription.id);
    assert.equal(oldFree?.status, 'EXPIRED');

    // 4. Idempotency check: Reconciling again is a no-op
    const result2 = await SubscriptionService.reconcileSubscription(db, razorpayClient, {
      providerSubscriptionId: subProviderId
    });
    assert.equal(result2.reconciled, true);
    assert.equal(result2.actionTaken, 'already_active');
  });

  test('MISSION 2: SubscriptionService.reconcileSubscription refuses to activate if Razorpay is not active', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-reconcile-inactive';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    const subProviderId = 'sub_rzp_reconcile_created_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    const paidOrder = await SubscriptionService.createSubscription(db, razorpayClient, {
      householdId,
      planCode: 'evolve_monthly'
    });

    // Mock Razorpay state as 'created' (payment not completed)
    razorpayClient.subscriptionStore.set(subProviderId, {
      id: subProviderId,
      planId: 'plan_evolve_monthly',
      status: 'created'
    });

    const result = await SubscriptionService.reconcileSubscription(db, razorpayClient, {
      providerSubscriptionId: subProviderId
    });

    assert.equal(result.reconciled, false);
    assert.equal(result.actionTaken, 'provider_not_active');
    assert.equal(result.currentStatus, 'PENDING_PAYMENT');

    const dbSub = await SubscriptionRepository.getSubscriptionById(db, paidOrder.subscription.id);
    assert.equal(dbSub?.status, 'PENDING_PAYMENT');
  });

  test('MISSION 3: webhook processing rollback ensures failed handler does not poison payment_events', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-webhook-atomicity';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const subProviderId = 'sub_rzp_atomic_test_1';
    razorpayClient.nextSubscriptionId = subProviderId;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });
    const subId = JSON.parse(createRes.payload).subscriptionId;

    // Set subscription into EXPIRED (terminal state where no transitions are permitted)
    await db.query(`UPDATE subscriptions SET status = 'EXPIRED' WHERE id = $1;`, [subId]);

    const eventId = 'evt_failed_transition_999';
    const webhookBody = JSON.stringify({
      event: 'subscription.activated',
      event_id: eventId,
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: 'active'
          }
        }
      }
    });
    const signature = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(webhookBody).digest('hex');

    // Attempt webhook: Transition EXPIRED -> ACTIVE must throw and roll back transaction
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId },
      payload: webhookBody
    });

    assert.equal(res.statusCode, 422); // InvalidStateTransitionError maps to 422 UNPROCESSABLE_ENTITY

    // Verify NO row was recorded in payment_events (transaction rolled back)
    const eventRow = await SubscriptionRepository.getPaymentEvent(db, 'razorpay', eventId);
    assert.equal(eventRow, null, 'payment_events row must NOT be recorded on failure');
  });
});
