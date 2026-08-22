import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { SubscriptionService } from '../src/domain/subscription/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionStates } from '../src/domain/subscription/types.js';
import { MockRazorpayClient } from '../src/domain/razorpay/mock-client.js';
import { MockN8nClient } from '../src/domain/gateway/mock-client.js';
import { UsageService } from '../src/domain/usage/service.js';
import { UsageRepository } from '../src/domain/usage/repository.js';
import { QuotaExceededError } from '../src/errors/index.js';

interface MockUser {
  userId: string;
  email: string;
}

class TestAuthVerifier {
  private users = new Map<string, MockUser>();

  public registerUser(token: string, user: MockUser) {
    this.users.set(token, user);
  }

  public async verifyAccessToken(token: string) {
    const user = this.users.get(token);
    if (!user) throw new Error('Invalid token');
    return {
      userId: user.userId,
      email: user.email
    };
  }
}

describe('Phase 2: Usage Accounting Foundation & AI Quota Enforcement', () => {
  let db: any;
  let authVerifier: TestAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let app: any;

  beforeEach(async () => {
    const mem = newDb();
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: mem.public.getType('uuid'),
      impure: true,
      implementation: () => crypto.randomUUID()
    });

    mem.public.registerFunction({
      name: 'pg_advisory_xact_lock',
      args: [mem.public.getType('int')],
      returns: mem.public.getType('bool'),
      impure: true,
      implementation: () => true
    });

    mem.public.registerFunction({
      name: 'pg_advisory_xact_lock',
      args: [mem.public.getType('text')],
      returns: mem.public.getType('bool'),
      impure: true,
      implementation: () => true
    });

    mem.public.registerFunction({
      name: 'hashtext',
      args: [mem.public.getType('text')],
      returns: mem.public.getType('int'),
      impure: false,
      implementation: (text: string) => {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
        }
        return hash;
      }
    });

    const pg = mem.adapters.createPg();
    const pool = new pg.Pool();

    db = {
      query: (text: string, params?: any[]) => pool.query(text, params),
      transaction: async (callback: any) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback(client);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      isHealthy: async () => true,
      close: async () => pool.end()
    };

    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    razorpayClient = new MockRazorpayClient({ keyId: 'rzp_test_key', keySecret: 'rzp_secret' });
    n8nClient = new MockN8nClient();

    await SubscriptionService.syncPlans(db, {
      starterId: 'plan_starter_test',
      growthId: 'plan_growth_test',
      familyId: 'plan_family_test'
    });

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      RAZORPAY_KEY_ID: 'rzp_test_key',
      RAZORPAY_KEY_SECRET: 'rzp_secret',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
      RAZORPAY_PLAN_STARTER_ID: 'plan_starter_test',
      RAZORPAY_PLAN_GROWTH_ID: 'plan_growth_test',
      RAZORPAY_PLAN_FAMILY_ID: 'plan_family_test'
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient,
      n8nClient
    });
  });

  it('successful Appu message request consumes exactly 1 AI session', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-1', {
      userId: parentUserId,
      email: 'parent1@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent1@example.com',
      householdName: 'Verma Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const subscription = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_1',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Aarav',
      gradeBand: 'Grade 5'
    });

    // Check usage before request
    const usageBefore = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usageBefore.aiSessions.used, 0);
    assert.equal(usageBefore.aiSessions.limit, 100);
    assert.equal(usageBefore.aiSessions.remaining, 100);

    // Make authenticated Appu message request
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: 'Bearer token-parent-1' },
      payload: {
        childId: child.id,
        message: 'How do rockets fly?'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.childId, child.id);
    assert.ok(body.text);

    // Check usage after request: exactly 1 session consumed
    const usageAfter = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usageAfter.aiSessions.used, 1);
    assert.equal(usageAfter.aiSessions.remaining, 99);
  });

  it('failed upstream provider request rolls back and does not permanently consume AI quota', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-2', {
      userId: parentUserId,
      email: 'parent2@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent2@example.com',
      householdName: 'Sharma Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_2',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Diya',
      gradeBand: 'Grade 6'
    });

    // Make n8n client simulate upstream failure
    n8nClient.sendMessage = async () => {
      throw new Error('Upstream provider timed out');
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: 'Bearer token-parent-2' },
      payload: {
        childId: child.id,
        message: 'Explain photosynthesis'
      }
    });

    assert.equal(res.statusCode, 502);

    // Quota remains 0 consumed because reservation was released
    const usage = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usage.aiSessions.used, 0);
    assert.equal(usage.aiSessions.remaining, 100);
  });

  it('exhausted AI quota rejects with 429 and does NOT invoke n8n', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-3', {
      userId: parentUserId,
      email: 'parent3@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent3@example.com',
      householdName: 'Gupta Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const subscription = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_3',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Rohan',
      gradeBand: 'Grade 7'
    });

    // Simulate 100 already-consumed sessions in the current period
    const period = UsageRepository.resolveUsagePeriod(subscription);
    await db.query(
      `INSERT INTO usage_records (
         household_id, subscription_id, child_id, metric, quantity, status,
         period_start, period_end, created_at, updated_at
       ) VALUES ($1, $2, $3, 'ai_sessions', 100, 'committed', $4, $5, NOW(), NOW())`,
      [household.id, subscription.id, child.id, period.startsAt.toISOString(), period.endsAt.toISOString()]
    );

    let n8nCalled = false;
    n8nClient.sendMessage = async () => {
      n8nCalled = true;
      return { text: 'Hello', audioSource: null };
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: 'Bearer token-parent-3' },
      payload: {
        childId: child.id,
        message: 'Tell me a story'
      }
    });

    assert.equal(res.statusCode, 429);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'quota_exceeded');
    assert.equal(n8nCalled, false); // INVARIANT: n8n was not called!
  });

  it('GET /api/usage/current returns period, AI session metrics and pending voice status', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-4', {
      userId: parentUserId,
      email: 'parent4@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent4@example.com',
      householdName: 'Mehta Household'
    });

    const growthPlan = await SubscriptionRepository.getPlanByCode(db, 'growth');
    const subscription = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: growthPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_growth_1',
      status: SubscriptionStates.ACTIVE
    });

    const period = UsageRepository.resolveUsagePeriod(subscription);
    await db.query(
      `INSERT INTO usage_records (
         household_id, subscription_id, metric, quantity, status,
         period_start, period_end, created_at, updated_at
       ) VALUES ($1, $2, 'ai_sessions', 7, 'committed', $3, $4, NOW(), NOW())`,
      [household.id, subscription.id, period.startsAt.toISOString(), period.endsAt.toISOString()]
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/usage/current',
      headers: { authorization: 'Bearer token-parent-4' }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.period.startsAt);
    assert.ok(body.period.endsAt);
    assert.equal(body.aiSessions.used, 7);
    assert.equal(body.aiSessions.limit, 300); // Growth plan limit
    assert.equal(body.voiceMinutes.used, 0);
    assert.equal(body.voiceMinutes.limit, 90);
    assert.equal(body.voiceMinutes.remaining, 90);
    assert.equal(body.voiceMinutes.meteringStatus, 'active');
  });

  it('ADVERSARIAL: Household A cannot view or consume Household B usage', async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    authVerifier.registerUser('token-parent-a', { userId: userA, email: 'parentA@example.com' });
    authVerifier.registerUser('token-parent-b', { userId: userB, email: 'parentB@example.com' });

    const { household: hhA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: userA,
      email: 'parentA@example.com',
      householdName: 'Household A'
    });

    const { household: hhB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: userB,
      email: 'parentB@example.com',
      householdName: 'Household B'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: hhA.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_a',
      status: SubscriptionStates.ACTIVE
    });

    await SubscriptionRepository.createSubscription(db, {
      householdId: hhB.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_b',
      status: SubscriptionStates.ACTIVE
    });

    const childA = await TenancyRepository.createChildProfile(db, {
      householdId: hhA.id,
      preferredName: 'Child A',
      gradeBand: 'Grade 5'
    });

    // Parent B attempts to message Child A
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: 'Bearer token-parent-b' },
      payload: {
        childId: childA.id,
        message: 'Hello'
      }
    });

    assert.equal(res.statusCode, 404); // Child not found in Household B
  });

  it('retrying Appu message request with same Idempotency-Key header consumes exactly 1 AI session', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-idem', {
      userId: parentUserId,
      email: 'parent.idem@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.idem@example.com',
      householdName: 'Idempotency Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_idem',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Tara',
      gradeBand: 'Grade 4'
    });

    const clientKey = 'msg_req_uuid_12345';

    // First request with idempotency key
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-idem',
        'idempotency-key': clientKey
      },
      payload: {
        childId: child.id,
        message: 'Tell me about Jupiter'
      }
    });

    assert.equal(res1.statusCode, 200);

    // Second request with SAME idempotency key (retry)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-idem',
        'idempotency-key': clientKey
      },
      payload: {
        childId: child.id,
        message: 'Tell me about Jupiter'
      }
    });

    assert.equal(res2.statusCode, 200);

    // Verify usage count is exactly 1 (not 2)
    const usage = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usage.aiSessions.used, 1);
    assert.equal(usage.aiSessions.remaining, 99);
  });

  it('OPTIONS /api/appu/message preflight accepts Idempotency-Key header and returns 204', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/appu/message',
      headers: {
        origin: 'http://localhost:5500',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type, idempotency-key'
      }
    });

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5500');
    const allowHeaders = String(res.headers['access-control-allow-headers'] || '');
    assert.ok(allowHeaders.toLowerCase().includes('idempotency-key'), 'CORS must allow Idempotency-Key');
    assert.ok(allowHeaders.toLowerCase().includes('authorization'), 'CORS must allow Authorization');
    assert.ok(allowHeaders.toLowerCase().includes('content-type'), 'CORS must allow Content-Type');
  });

  it('UsageRepository.resolveUsagePeriod enforces PERIOD INVARIANTS: containing now, future/expired fallback, and timezone-safe ISO output', () => {
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const refNow = new Date('2026-08-21T10:00:00.000Z');

    // Invariant 1: Valid provider period containing now -> source: 'provider'
    const periodProvider = UsageRepository.resolveUsagePeriod(
      {
        currentPeriodStart: new Date('2026-08-05T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-09-05T00:00:00.000Z'),
        createdAt
      },
      refNow
    );
    assert.equal(periodProvider.source, 'provider');
    assert.equal(periodProvider.startsAt.toISOString(), '2026-08-05T00:00:00.000Z');
    assert.equal(periodProvider.endsAt.toISOString(), '2026-09-05T00:00:00.000Z');

    // Invariant 2: Future provider period (starts after now, e.g. Oct 2026 when now is Aug 2026)
    // Must NOT masquerade as current provider period -> safely uses fallback
    const futurePeriod = UsageRepository.resolveUsagePeriod(
      {
        currentPeriodStart: new Date('2026-10-20T18:30:00.000Z'),
        currentPeriodEnd: new Date('2026-11-20T18:30:00.000Z'),
        createdAt
      },
      refNow
    );
    assert.equal(futurePeriod.source, 'fallback');
    // Fallback must cover current time (refNow)
    assert.ok(futurePeriod.startsAt.getTime() <= refNow.getTime());
    assert.ok(refNow.getTime() < futurePeriod.endsAt.getTime());

    // Invariant 3: Expired provider period (ends before now)
    // Must NOT masquerade as current provider period -> safely uses fallback
    const expiredPeriod = UsageRepository.resolveUsagePeriod(
      {
        currentPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
        createdAt
      },
      refNow
    );
    assert.equal(expiredPeriod.source, 'fallback');
    assert.ok(expiredPeriod.startsAt.getTime() <= refNow.getTime());
    assert.ok(refNow.getTime() < expiredPeriod.endsAt.getTime());

    // Invariant 4: Subscription has null/missing provider timestamps -> fallback
    const periodFallback = UsageRepository.resolveUsagePeriod(
      {
        currentPeriodStart: null,
        currentPeriodEnd: null,
        createdAt
      },
      refNow
    );
    assert.equal(periodFallback.source, 'fallback');
    assert.ok(periodFallback.startsAt.toISOString());
    assert.ok(periodFallback.endsAt.toISOString());
  });

  it(
    'deleting child profile sets usage_records.child_id to NULL while preserving household record',
    { skip: 'PostgreSQL 15+ partial ON DELETE SET NULL (col) cascade is verified on real PostgreSQL in postgres-integration.test.ts' },
    async () => {
    const parentUserId = crypto.randomUUID();
    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.childdel@example.com',
      householdName: 'Child Delete Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const sub = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_child_del',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Child To Remove',
      gradeBand: 'Grade 2'
    });

    // Create usage record referencing child
    const res = await UsageRepository.reserveUsageAtomic(db, {
      householdId: household.id,
      subscriptionId: sub.id,
      childId: child.id,
      metric: 'ai_sessions',
      quantity: 1,
      quotaLimit: 100
    });
    await UsageRepository.commitReservation(db, household.id, res.reservationId);

    // Delete child profile
    await TenancyRepository.deleteChildProfile(db, household.id, child.id);

    // Verify usage record remains in database with child_id = NULL
    const checkRes = await db.query(
      'SELECT id, household_id, child_id, quantity, status FROM usage_records WHERE id = $1',
      [res.reservationId]
    );

    assert.equal(checkRes.rows.length, 1);
    assert.equal(checkRes.rows[0].household_id, household.id);
    assert.equal(checkRes.rows[0].child_id, null);
    assert.equal(checkRes.rows[0].status, 'committed');
  });

  it('same idempotency key + different message returns conflict (409) and does NOT invoke n8n', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-conflict', {
      userId: parentUserId,
      email: 'parent.conflict@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.conflict@example.com',
      householdName: 'Conflict Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_conflict',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Aanya',
      gradeBand: 'Grade 3'
    });

    const reusedKey = 'reused_client_key_123';
    n8nClient.callCount = 0;

    // First request: succeeds
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-conflict',
        'idempotency-key': reusedKey
      },
      payload: {
        childId: child.id,
        message: 'Tell me about dinosaurs'
      }
    });

    assert.equal(res1.statusCode, 200);
    assert.equal(n8nClient.callCount, 1);

    // Second request with SAME key but DIFFERENT message -> must return 409 Conflict
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-conflict',
        'idempotency-key': reusedKey
      },
      payload: {
        childId: child.id,
        message: 'How do airplanes fly?' // Different message
      }
    });

    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.error.code, 'idempotency_conflict');
    // n8n must NOT have been invoked a second time
    assert.equal(n8nClient.callCount, 1);

    // Usage must remain exactly 1 unit
    const usage = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usage.aiSessions.used, 1);
  });

  it('different logical messages receive separate usage charges', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-parent-separate', {
      userId: parentUserId,
      email: 'parent.separate@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.separate@example.com',
      householdName: 'Separate Household'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_separate',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Arjun',
      gradeBand: 'Grade 6'
    });

    // Message 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-separate',
        'idempotency-key': 'key_msg_1'
      },
      payload: {
        childId: child.id,
        message: 'What is photosynthesis?'
      }
    });
    assert.equal(res1.statusCode, 200);

    // Message 2 (different key & different message)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-parent-separate',
        'idempotency-key': 'key_msg_2'
      },
      payload: {
        childId: child.id,
        message: 'What is gravity?'
      }
    });
    assert.equal(res2.statusCode, 200);

    // Total used must be 2
    const usage = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(usage.aiSessions.used, 2);
    assert.equal(usage.aiSessions.remaining, 98);
  });

  // ============================================================================
  // VOICE USAGE METERING & QUOTA TESTS
  // ============================================================================

  it('records measured voice duration exactly once per message and updates usage summary', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-voice-1', {
      userId: parentUserId,
      email: 'parent.voice1@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.voice1@example.com',
      householdName: 'Voice Family 1'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const sub = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_voice_1',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Diya',
      gradeBand: 'Grade 4'
    });

    n8nClient.nextResponse = {
      text: 'Here is your voice answer',
      audioSource: 'data:audio/mpeg;base64,mockAudioStream',
      audioDurationMs: 120000 // 120,000 ms = 2.0 minutes
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-voice-1',
        'idempotency-key': 'voice_test_msg_1'
      },
      payload: {
        childId: child.id,
        message: 'Tell me a story about space'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.text, 'Here is your voice answer');
    assert.equal(body.audioDurationMs, 120000);
    assert.ok(body.audioSource);

    // GET /api/usage/current
    const summary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(summary.voiceMinutes.meteringStatus, 'active');
    assert.equal(summary.voiceMinutes.used, 2.0); // 120,000 ms / 60,000 = 2.0 min
    assert.equal(summary.voiceMinutes.limit, 30);
    assert.equal(summary.voiceMinutes.remaining, 28.0);
  });

  it('retrying with same idempotency-key does not double-charge voice duration', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-voice-2', {
      userId: parentUserId,
      email: 'parent.voice2@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.voice2@example.com',
      householdName: 'Voice Family 2'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_voice_2',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Kabir',
      gradeBand: 'Grade 5'
    });

    n8nClient.nextResponse = {
      text: 'Answer with audio',
      audioSource: 'data:audio/mpeg;base64,mockAudioData',
      audioDurationMs: 60000 // 1.0 minute (60,000 ms)
    };

    // First attempt
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-voice-2',
        'idempotency-key': 'idemp_voice_retry_key'
      },
      payload: {
        childId: child.id,
        message: 'Tell me a science fact'
      }
    });
    assert.equal(res1.statusCode, 200);

    // Second retry attempt with same idempotency key and same message
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-voice-2',
        'idempotency-key': 'idemp_voice_retry_key'
      },
      payload: {
        childId: child.id,
        message: 'Tell me a science fact'
      }
    });
    assert.equal(res2.statusCode, 200);

    // Voice usage must be charged exactly once (1.0 min, not 2.0 min)
    const summary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(summary.voiceMinutes.used, 1.0);
    assert.equal(summary.voiceMinutes.remaining, 29.0);
  });

  it('exhausted voice quota omits audio response while allowing AI text response to succeed', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-voice-3', {
      userId: parentUserId,
      email: 'parent.voice3@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.voice3@example.com',
      householdName: 'Voice Family 3'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const sub = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_voice_3',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Mira',
      gradeBand: 'Grade 2'
    });

    // Exhaust 30 minutes of voice usage in advance (30 * 60,000 ms = 1,800,000 ms)
    await UsageService.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId: sub.id,
      childId: child.id,
      durationMs: 1800000,
      quotaLimitMs: 1800000,
      idempotencyKey: 'exhaust_voice_quota'
    });

    const preSummary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(preSummary.voiceMinutes.used, 30.0);
    assert.equal(preSummary.voiceMinutes.remaining, 0.0);

    // Upstream n8n would generate audio if called
    n8nClient.nextResponse = {
      text: 'Text explanation about dolphins',
      audioSource: 'data:audio/mpeg;base64,mockAudioData',
      audioDurationMs: 15000
    };

    // User sends message when voice quota is 0
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-voice-3',
        'idempotency-key': 'msg_after_voice_exhaust'
      },
      payload: {
        childId: child.id,
        message: 'Tell me about dolphins'
      }
    });

    // Invariant: AI text response SUCCEEDS (200 OK), but audio is safely omitted (audioSource = null)
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.text, 'Text explanation about dolphins');
    assert.equal(body.audioSource, null);
    assert.equal(body.audioDurationMs, null);

    // AI session quota was consumed (1 session)
    const postSummary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(postSummary.aiSessions.used, 1);
    assert.equal(postSummary.voiceMinutes.used, 30.0);
  });

  it('strict voice boundary: generated audio exceeding remaining quota is suppressed without charging', async () => {
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token-voice-boundary', {
      userId: parentUserId,
      email: 'parent.boundary@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent.boundary@example.com',
      householdName: 'Voice Boundary Family'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');
    const sub = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_voice_boundary',
      status: SubscriptionStates.ACTIVE
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Arjun',
      gradeBand: 'Grade 4'
    });

    // 1. Pre-charge 1,798,000 ms (29.966 min) -> Remaining = 2,000 ms (2 seconds)
    await UsageService.recordVoiceUsageAtomic(db, {
      householdId: household.id,
      subscriptionId: sub.id,
      childId: child.id,
      durationMs: 1798000,
      quotaLimitMs: 1800000,
      idempotencyKey: 'boundary_pre_charge'
    });

    // 2. n8n returns 15,000 ms (15 seconds) audio, which exceeds 2,000 ms remaining
    n8nClient.nextResponse = {
      text: 'Here is a 15-second response about space',
      audioSource: 'data:audio/mpeg;base64,mock15sAudio',
      audioDurationMs: 15000
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer token-voice-boundary',
        'idempotency-key': 'boundary_overspend_msg'
      },
      payload: {
        childId: child.id,
        message: 'Tell me about space'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    // Invariant: Text response delivered, audio suppressed, zero voice overcharge
    assert.equal(body.text, 'Here is a 15-second response about space');
    assert.equal(body.audioSource, null);
    assert.equal(body.audioDurationMs, null);

    const postSummary = await UsageService.getHouseholdUsageSummary(db, household.id);
    assert.equal(postSummary.voiceMinutes.used, 30.0); // 1,798,000 / 60,000 = 29.966 -> rounded display
    assert.ok(postSummary.voiceMinutes.remaining >= 0);
  });

  it('cross-household voice usage isolation: Household A voice usage does not affect Household B', async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    authVerifier.registerUser('token-voice-iso-a', { userId: userA, email: 'a@example.com' });
    authVerifier.registerUser('token-voice-iso-b', { userId: userB, email: 'b@example.com' });

    const { household: hhA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: userA,
      email: 'a@example.com',
      householdName: 'Household A'
    });

    const { household: hhB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: userB,
      email: 'b@example.com',
      householdName: 'Household B'
    });

    const starterPlan = await SubscriptionRepository.getPlanByCode(db, 'starter');

    const subA = await SubscriptionRepository.createSubscription(db, {
      householdId: hhA.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_iso_a',
      status: SubscriptionStates.ACTIVE
    });

    const subB = await SubscriptionRepository.createSubscription(db, {
      householdId: hhB.id,
      planId: starterPlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_iso_b',
      status: SubscriptionStates.ACTIVE
    });

    // Record 600,000 ms (10.0 min) for Household A
    await UsageService.recordVoiceUsageAtomic(db, {
      householdId: hhA.id,
      subscriptionId: subA.id,
      durationMs: 600000,
      quotaLimitMs: 1800000,
      idempotencyKey: 'iso_voice_a'
    });

    const summaryA = await UsageService.getHouseholdUsageSummary(db, hhA.id);
    const summaryB = await UsageService.getHouseholdUsageSummary(db, hhB.id);

    assert.equal(summaryA.voiceMinutes.used, 10.0);
    assert.equal(summaryA.voiceMinutes.remaining, 20.0);

    // Household B must have 0 used and full 30.0 min remaining
    assert.equal(summaryB.voiceMinutes.used, 0.0);
    assert.equal(summaryB.voiceMinutes.remaining, 30.0);
  });
});

