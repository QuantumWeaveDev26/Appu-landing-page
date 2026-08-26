import { test, describe, beforeEach } from 'node:test';
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

describe('Phase 2 Production Payment Bug: State Machine & Out-of-Order Webhooks Regression Suite', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

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
      RAZORPAY_KEY_ID: 'rzp_test_key_id',
      RAZORPAY_KEY_SECRET: 'rzp_test_key_secret',
      RAZORPAY_WEBHOOK_SECRET: 'rzp_test_webhook_secret'
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient
    });
  });

  async function setupHouseholdAndSubscription(subProviderId = 'sub_TUK4nw0efv6LYX') {
    const parentUserId = crypto.randomUUID();
    const token = `token-${parentUserId}`;
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    razorpayClient.nextSubscriptionId = subProviderId;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });
    const subId = JSON.parse(createRes.payload).subscriptionId;

    return { token, householdId, subId, subProviderId };
  }

  function createWebhookPayload(event: string, subProviderId: string, entityStatus: string, eventId?: string) {
    const eid = eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const body = JSON.stringify({
      event,
      event_id: eid,
      payload: {
        subscription: {
          entity: {
            id: subProviderId,
            status: entityStatus,
            current_start: Math.floor(Date.now() / 1000),
            current_end: Math.floor(Date.now() / 1000) + 30 * 86400
          }
        }
      }
    });
    const signature = crypto.createHmac('sha256', razorpayClient.webhookSecret).update(body).digest('hex');
    return { body, signature, eventId: eid };
  }

  // TEST A: subscription.activated -> ACTIVE then subscription.authenticated with provider entity status active -> final state ACTIVE
  test('TEST A: subscription.activated -> ACTIVE then delayed subscription.authenticated with entity status active -> remains ACTIVE', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. subscription.activated (entity status active)
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });
    assert.equal(res1.statusCode, 200);

    const sub1 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub1?.status, SubscriptionStates.ACTIVE);

    // 2. subscription.authenticated (entity status active)
    const wh2 = createWebhookPayload('subscription.authenticated', subProviderId, 'active');
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });
    assert.equal(res2.statusCode, 200);

    const sub2 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub2?.status, SubscriptionStates.ACTIVE, 'Subscription must remain ACTIVE and not regress to AUTHENTICATED');
  });

  // TEST B: subscription.charged -> ACTIVE then delayed subscription.authenticated -> ACTIVE remains ACTIVE
  test('TEST B: subscription.charged -> ACTIVE then delayed subscription.authenticated -> ACTIVE remains ACTIVE', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. subscription.charged (entity status active)
    const wh1 = createWebhookPayload('subscription.charged', subProviderId, 'active');
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });
    assert.equal(res1.statusCode, 200);

    const sub1 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub1?.status, SubscriptionStates.ACTIVE);

    // 2. delayed subscription.authenticated (without active entity status, e.g. 'authenticated')
    const wh2 = createWebhookPayload('subscription.authenticated', subProviderId, 'authenticated');
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });
    assert.equal(res2.statusCode, 200);

    const sub2 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub2?.status, SubscriptionStates.ACTIVE, 'ACTIVE must NOT be downgraded by delayed subscription.authenticated');
  });

  // TEST C: ACTIVE -> subscription.pending -> PENDING_PAYMENT allowed
  test('TEST C: ACTIVE -> subscription.pending -> PENDING_PAYMENT allowed', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. Activate
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Pending payment event
    const wh2 = createWebhookPayload('subscription.pending', subProviderId, 'pending');
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });
    assert.equal(res2.statusCode, 200);

    const sub2 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub2?.status, SubscriptionStates.PENDING_PAYMENT, 'ACTIVE -> PENDING_PAYMENT must be allowed on payment retry');
  });

  // TEST D: PENDING_PAYMENT -> subscription.charged/activated -> ACTIVE
  test('TEST D: PENDING_PAYMENT -> subscription.charged/activated -> ACTIVE', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // Currently in PENDING_PAYMENT
    const sub0 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub0?.status, SubscriptionStates.PENDING_PAYMENT);

    // subscription.charged event
    const wh = createWebhookPayload('subscription.charged', subProviderId, 'active');
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh.signature, 'x-razorpay-event-id': wh.eventId },
      payload: wh.body
    });
    assert.equal(res.statusCode, 200);

    const sub1 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub1?.status, SubscriptionStates.ACTIVE, 'PENDING_PAYMENT -> ACTIVE must be allowed on successful charge');
  });

  // TEST E: ACTIVE -> subscription.paused -> PAUSED
  test('TEST E: ACTIVE -> subscription.paused -> PAUSED', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. Activate
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Pause
    const wh2 = createWebhookPayload('subscription.paused', subProviderId, 'paused');
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });
    assert.equal(res2.statusCode, 200);

    const sub2 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub2?.status, SubscriptionStates.PAUSED);
  });

  // TEST F: PAUSED -> subscription.resumed -> ACTIVE
  test('TEST F: PAUSED -> subscription.resumed -> ACTIVE', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. Activate
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Pause
    const wh2 = createWebhookPayload('subscription.paused', subProviderId, 'paused');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });

    // 3. Resume
    const wh3 = createWebhookPayload('subscription.resumed', subProviderId, 'active');
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh3.signature, 'x-razorpay-event-id': wh3.eventId },
      payload: wh3.body
    });
    assert.equal(res3.statusCode, 200);

    const sub3 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub3?.status, SubscriptionStates.ACTIVE);
  });

  // TEST G: ACTIVE -> subscription.cancelled -> CANCELLED
  test('TEST G: ACTIVE -> subscription.cancelled -> CANCELLED', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. Activate
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Cancel
    const wh2 = createWebhookPayload('subscription.cancelled', subProviderId, 'cancelled');
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });
    assert.equal(res2.statusCode, 200);

    const sub2 = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(sub2?.status, SubscriptionStates.CANCELLED);
  });

  // TEST H: CANCELLED then delayed subscription.activated -> CANCELLED remains terminal
  test('TEST H: CANCELLED then delayed subscription.activated -> CANCELLED remains terminal', async () => {
    const { subId, subProviderId } = await setupHouseholdAndSubscription();

    // 1. Cancel
    await db.query(`UPDATE subscriptions SET status = 'CANCELLED' WHERE id = $1;`, [subId]);

    // 2. Delayed activated webhook
    const wh = createWebhookPayload('subscription.activated', subProviderId, 'active');
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh.signature, 'x-razorpay-event-id': wh.eventId },
      payload: wh.body
    });
    assert.equal(res.statusCode, 200);

    const subAfter = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(subAfter?.status, SubscriptionStates.CANCELLED, 'CANCELLED terminal state must NOT be resurrected to ACTIVE');
  });

  // TEST I: Existing ACTIVE subscription + newer PENDING_PAYMENT checkout -> current entitlement API returns ACTIVE subscription
  test('TEST I: Existing ACTIVE subscription + newer PENDING_PAYMENT checkout -> GET /api/subscriptions/current returns ACTIVE subscription', async () => {
    const { token, householdId, subId, subProviderId } = await setupHouseholdAndSubscription('sub_TUK4nw0efv6LYX');

    // 1. Activate initial subscription
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Simulate a second checkout attempt in PENDING_PAYMENT (e.g. user clicked checkout for another plan)
    const planEvolvePlus = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_monthly');
    await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: planEvolvePlus!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_NEW_PENDING_123',
      status: SubscriptionStates.PENDING_PAYMENT
    });

    // 3. Query GET /api/subscriptions/current
    const currentRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(currentRes.statusCode, 200);

    const currentData = JSON.parse(currentRes.payload);
    assert.equal(currentData.hasSubscription, true);
    assert.equal(currentData.subscription.id, subId, 'Must return the ACTIVE subscription, not the newer PENDING_PAYMENT');
    assert.equal(currentData.subscription.status, 'ACTIVE');
    assert.equal(currentData.subscription.planCode, 'evolve_monthly');
    assert.notEqual(currentData.entitlements, null, 'Must return active paid entitlements');
  });

  // TEST J: Duplicate checkout prevention: calling createSubscription for same active plan returns existing active subscription
  test('TEST J: Duplicate checkout prevention: createSubscription returns existing ACTIVE subscription without duplicate Razorpay sub', async () => {
    const { token, householdId, subId, subProviderId } = await setupHouseholdAndSubscription('sub_TUK4nw0efv6LYX');

    // 1. Activate
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 2. Call POST /api/subscriptions again for the same 'evolve_monthly' plan
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions',
      headers: { authorization: `Bearer ${token}` },
      payload: { planCode: 'evolve_monthly' }
    });
    assert.equal(dupRes.statusCode, 201);

    const dupData = JSON.parse(dupRes.payload);
    assert.equal(dupData.subscriptionId, subId, 'Must return existing subscription ID');
    assert.equal(dupData.status, 'ACTIVE');
    assert.equal(dupData.providerSubscriptionId, subProviderId);
  });

  // RETRY TEST A: Household has old CANCELLED subscription and new PENDING_PAYMENT subscription. verify-checkout on new provider ID succeeds.
  test('RETRY TEST A: Old CANCELLED subscription + new PENDING_PAYMENT subscription -> verify-checkout verifies NEW row and leaves CANCELLED row unchanged', async () => {
    const parentUserId = crypto.randomUUID();
    const token = `token-${parentUserId}`;
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    // 1. First subscription attempt fails/cancels
    const plan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    const oldSub = await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: plan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_OLD_CANCELLED_123',
      status: SubscriptionStates.CANCELLED
    });

    // 2. Fresh subscription attempt in PENDING_PAYMENT
    const newSub = await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: plan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_NEW_SUCCESS_456',
      status: SubscriptionStates.PENDING_PAYMENT
    });

    // 3. Customer payment succeeds on new subscription
    const paymentId = 'pay_test_payment_999';
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|sub_NEW_SUCCESS_456`)
      .digest('hex');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: 'sub_NEW_SUCCESS_456',
        razorpaySignature: signature
      }
    });

    assert.equal(verifyRes.statusCode, 200, 'Verification of new subscription must succeed with 200');
    const verifyData = JSON.parse(verifyRes.payload);
    assert.equal(verifyData.verified, true);
    assert.equal(verifyData.status, 'AUTHENTICATED');

    // 4. Verify exact database rows
    const updatedNewSub = await SubscriptionRepository.getSubscriptionById(db, newSub.id);
    assert.equal(updatedNewSub?.status, 'AUTHENTICATED', 'New subscription row must be AUTHENTICATED');

    const checkOldSub = await SubscriptionRepository.getSubscriptionById(db, oldSub.id);
    assert.equal(checkOldSub?.status, 'CANCELLED', 'Old subscription row must remain CANCELLED and untouched');
  });

  // RETRY TEST B: Household has ACTIVE older subscription plus new checkout -> verification operates on exact supplied provider ID
  test('RETRY TEST B: Older ACTIVE subscription + new checkout attempt -> verify-checkout operates strictly on exact supplied provider ID', async () => {
    const parentUserId = crypto.randomUUID();
    const token = `token-${parentUserId}`;
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    const planEvolve = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    const planEvolvePlus = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_monthly');

    // Older ACTIVE subscription
    const activeSub = await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: planEvolve!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_ACTIVE_OLD_111',
      status: SubscriptionStates.ACTIVE
    });

    // New checkout for upgrade in PENDING_PAYMENT
    const newSub = await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: planEvolvePlus!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_UPGRADE_NEW_222',
      status: SubscriptionStates.PENDING_PAYMENT
    });

    const paymentId = 'pay_upgrade_999';
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|sub_UPGRADE_NEW_222`)
      .digest('hex');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: 'sub_UPGRADE_NEW_222',
        razorpaySignature: signature
      }
    });

    assert.equal(verifyRes.statusCode, 200);
    const updatedNewSub = await SubscriptionRepository.getSubscriptionById(db, newSub.id);
    assert.equal(updatedNewSub?.status, 'AUTHENTICATED', 'New upgrade subscription must become AUTHENTICATED');

    const checkActiveSub = await SubscriptionRepository.getSubscriptionById(db, activeSub.id);
    assert.equal(checkActiveSub?.status, 'ACTIVE', 'Existing active subscription must remain ACTIVE');
  });

  // RETRY TEST C: Unknown provider subscription ID -> reject with 404
  test('RETRY TEST C: Unknown provider subscription ID -> reject with 404', async () => {
    const parentUserId = crypto.randomUUID();
    const token = `token-${parentUserId}`;
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });

    const paymentId = 'pay_unknown_123';
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|sub_UNKNOWN_999`)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: 'sub_UNKNOWN_999',
        razorpaySignature: signature
      }
    });

    assert.equal(res.statusCode, 404);
  });

  // RETRY TEST D: Provider subscription belongs to another household -> reject with 404
  test('RETRY TEST D: Provider subscription belongs to another household -> reject with 404', async () => {
    // Household 1 (Victim)
    const victimUser = crypto.randomUUID();
    const tokenVictim = `token-${victimUser}`;
    authVerifier.registerToken(tokenVictim, { userId: victimUser });

    const ob1 = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenVictim}` },
      payload: {}
    });
    const household1Id = JSON.parse(ob1.payload).household.id;

    const plan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household1Id,
      planId: plan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_HOUSEHOLD_1_SUB',
      status: SubscriptionStates.PENDING_PAYMENT
    });

    // Household 2 (Attacker)
    const attackerUser = crypto.randomUUID();
    const tokenAttacker = `token-${attackerUser}`;
    authVerifier.registerToken(tokenAttacker, { userId: attackerUser });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenAttacker}` },
      payload: {}
    });

    const paymentId = 'pay_h2_attack';
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|sub_HOUSEHOLD_1_SUB`)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${tokenAttacker}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: 'sub_HOUSEHOLD_1_SUB',
        razorpaySignature: signature
      }
    });

    assert.equal(res.statusCode, 404, 'Cross-household checkout verification must be rejected with 404');
  });

  // RETRY TEST E: Exact submitted subscription is CANCELLED -> verify-checkout on that exact cancelled sub returns 422
  test('RETRY TEST E: Exact submitted subscription is CANCELLED -> verify-checkout rejects reactivation with 422', async () => {
    const parentUserId = crypto.randomUUID();
    const token = `token-${parentUserId}`;
    authVerifier.registerToken(token, { userId: parentUserId });

    const ob = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {}
    });
    const householdId = JSON.parse(ob.payload).household.id;

    const plan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: plan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_DIRECT_CANCELLED_SUB',
      status: SubscriptionStates.CANCELLED
    });

    const paymentId = 'pay_cancelled_sub';
    const signature = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|sub_DIRECT_CANCELLED_SUB`)
      .digest('hex');

    const res = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: 'sub_DIRECT_CANCELLED_SUB',
        razorpaySignature: signature
      }
    });

    assert.equal(res.statusCode, 422, 'CANCELLED -> AUTHENTICATED transition must be rejected with 422');
  });

  // RETRY TEST F: Successful checkout verification + activated/charged/authenticated webhooks arriving out of order -> final state ACTIVE
  test('RETRY TEST F: Checkout verify + out-of-order webhooks (activated -> charged -> authenticated) -> final state ACTIVE', async () => {
    const { token, subId, subProviderId } = await setupHouseholdAndSubscription('sub_OUT_OF_ORDER_FLOW');

    // 1. Browser verify-checkout
    const paymentId = 'pay_flow_123';
    const sig = crypto
      .createHmac('sha256', razorpayClient.secretKey)
      .update(`${paymentId}|${subProviderId}`)
      .digest('hex');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/subscriptions/verify-checkout',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: subProviderId,
        razorpaySignature: sig
      }
    });
    assert.equal(verifyRes.statusCode, 200);

    // 2. Webhook: subscription.activated
    const wh1 = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh1.signature, 'x-razorpay-event-id': wh1.eventId },
      payload: wh1.body
    });

    // 3. Webhook: subscription.charged
    const wh2 = createWebhookPayload('subscription.charged', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh2.signature, 'x-razorpay-event-id': wh2.eventId },
      payload: wh2.body
    });

    // 4. Webhook: subscription.authenticated (late)
    const wh3 = createWebhookPayload('subscription.authenticated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh3.signature, 'x-razorpay-event-id': wh3.eventId },
      payload: wh3.body
    });

    const finalSub = await SubscriptionRepository.getSubscriptionById(db, subId);
    assert.equal(finalSub?.status, SubscriptionStates.ACTIVE, 'Final state must be ACTIVE');
  });

  // RETRY TEST G: Frontend polling sees ACTIVE and returns active subscription without refresh
  test('RETRY TEST G: GET /api/subscriptions/current returns ACTIVE with full entitlements for frontend polling', async () => {
    const { token, subId, subProviderId } = await setupHouseholdAndSubscription('sub_POLLING_FLOW');

    // Webhook activates
    const wh = createWebhookPayload('subscription.activated', subProviderId, 'active');
    await app.inject({
      method: 'POST',
      url: '/api/webhooks/razorpay',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': wh.signature, 'x-razorpay-event-id': wh.eventId },
      payload: wh.body
    });

    // Polling endpoint GET /api/subscriptions/current
    const res = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.equal(data.hasSubscription, true);
    assert.equal(data.subscription.status, 'ACTIVE');
    assert.equal(data.subscription.id, subId);
    assert.notEqual(data.entitlements, null);
  });
});
