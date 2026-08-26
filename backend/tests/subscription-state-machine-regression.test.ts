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
});
