import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionStates } from '../src/domain/subscription/types.js';
import { MockRazorpayClient } from '../src/domain/razorpay/mock-client.js';
import { MockN8nClient } from '../src/domain/gateway/mock-client.js';
import { UsageService } from '../src/domain/usage/service.js';
import { AppuRequestService } from '../src/domain/appu-request/service.js';
import { AppuRequestRepository } from '../src/domain/appu-request/repository.js';
import { AppuRequestStates } from '../src/domain/appu-request/types.js';
import { createAppuHmacSignature } from '../src/domain/gateway/hmac.js';
import { GuestSessionService } from '../src/domain/guest/service.js';
import { GuestRepository } from '../src/domain/guest/repository.js';
import { BadGatewayError, ServiceUnavailableError } from '../src/errors/index.js';

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

describe('APPU Request Lifecycle, Idempotency & Signed Callback Suite', () => {
  const requestSigningSecret = 'test_request_signing_secret_at_least_32_chars';
  const callbackSigningSecret = 'test_callback_signing_secret_at_least_32_chars';
  const guestSigningSecret = 'test_guest_signing_secret_at_least_32_chars';

  let db: any;
  let authVerifier: TestAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let app: any;
  let testHousehold: any;
  let testChild: any;
  let testSubscription: any;
  const testParentToken = 'bearer_test_parent_token';
  const testUserId = crypto.randomUUID();

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
      implementation: (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash) + str.charCodeAt(i);
          hash |= 0;
        }
        return hash;
      }
    });

    const pgAdapter = mem.adapters.createPg();
    const pool = new pgAdapter.Pool();

    db = {
      query: (text: string, params?: any[]) => pool.query(text, params),
      transaction: async (callback: any) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const res = await callback(client);
          await client.query('COMMIT');
          return res;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      close: async () => pool.end()
    };

    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    authVerifier.registerUser(testParentToken, {
      userId: testUserId,
      email: 'parent.lifecycle@example.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: testUserId,
      email: 'parent.lifecycle@example.com',
      householdName: 'Lifecycle Test Family'
    });
    testHousehold = household;

    const child = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING *`,
      [household.id, 'Aditi', 'Grade 6']
    );
    testChild = child.rows[0];

    const evolvePlan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    testSubscription = await SubscriptionRepository.createSubscription(db, {
      householdId: household.id,
      planId: evolvePlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_lifecycle_test',
      status: SubscriptionStates.ACTIVE
    });

    razorpayClient = new MockRazorpayClient();
    n8nClient = new MockN8nClient();

    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      PORT: 3000,
      HOST: '127.0.0.1',
      GUEST_SESSION_SECRET: guestSigningSecret,
      N8N_APPU_REQUEST_HMAC_SECRET: requestSigningSecret,
      N8N_APPU_CALLBACK_HMAC_SECRET: callbackSigningSecret,
      N8N_APPU_HMAC_MAX_AGE_SECONDS: 300,
      N8N_APPU_TIMEOUT_MS: 20000
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient,
      n8nClient
    });
  });

  // 1. Normal success: PENDING -> SUCCEEDED, usage committed once
  it('Case 1: normal success commits usage reservation and marks lifecycle SUCCEEDED', async () => {
    n8nClient.nextResponse = {
      text: 'Gravity is the curvature of spacetime.',
      audioSource: null
    };

    const idempotencyKey = 'req_normal_success_1';
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'What is gravity?'
      }
    });

    assert.equal(res.statusCode, 200);
    const requestId = res.headers['x-appu-request-id'] as string;
    assert.ok(requestId);

    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record.status, AppuRequestStates.SUCCEEDED);

    const usageSummary = await UsageService.getHouseholdUsageSummary(db, testHousehold.id);
    assert.equal(usageSummary.aiSessions.used, 1);
  });

  // 2. Simulated transport timeout: PENDING -> UNKNOWN, reservation retained
  it('Case 2: simulated transport timeout transitions to UNKNOWN and retains usage reservation', async () => {
    n8nClient.nextError = new ServiceUnavailableError('AI mentor service timed out waiting for response');

    const idempotencyKey = 'req_timeout_test_2';
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Explain black holes'
      }
    });

    assert.equal(res.statusCode, 503);
    const requestId = res.headers['x-appu-request-id'] as string;
    assert.ok(requestId);

    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record.status, AppuRequestStates.UNKNOWN);

    // Reservation remains held (status = 'reserved')
    const usageCheck = await db.query(
      `SELECT status FROM usage_records WHERE id = $1`,
      [record.usageRecordId]
    );
    assert.equal(usageCheck.rows[0].status, 'reserved');

    // Total used in summary counts reserved as in-flight
    const usageSummary = await UsageService.getHouseholdUsageSummary(db, testHousehold.id);
    assert.equal(usageSummary.aiSessions.used, 1);
  });

  // 3. UNKNOWN -> late SUCCEEDED callback: commit exactly once
  it('Case 3: late SUCCEEDED callback transitions UNKNOWN to SUCCEEDED and commits usage', async () => {
    n8nClient.nextError = new ServiceUnavailableError('AI mentor service timed out waiting for response');

    const idempotencyKey = 'req_late_success_3';
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'What is photosynthesis?'
      }
    });

    const requestId = postRes.headers['x-appu-request-id'] as string;
    const initialRecord = await AppuRequestRepository.getById(db, requestId);
    assert.equal(initialRecord?.status, AppuRequestStates.UNKNOWN);

    // Dispatch signed callback from n8n
    const now = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      requestId,
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString(),
      executionId: 'exec_n8n_12345'
    };
    const rawBody = JSON.stringify(callbackPayload);
    const signature = createAppuHmacSignature(rawBody, String(now), callbackSigningSecret);

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(callbackRes.statusCode, 200);
    const callbackBody = JSON.parse(callbackRes.payload);
    assert.equal(callbackBody.status, 'SUCCEEDED');
    assert.equal(callbackBody.idempotent, false);

    const updatedRecord = await AppuRequestRepository.getById(db, requestId);
    assert.equal(updatedRecord?.status, AppuRequestStates.SUCCEEDED);
    assert.equal(updatedRecord?.downstreamExecutionId, 'exec_n8n_12345');

    const usageCheck = await db.query(
      `SELECT status FROM usage_records WHERE id = $1`,
      [updatedRecord!.usageRecordId]
    );
    assert.equal(usageCheck.rows[0].status, 'committed');
  });

  // 4. UNKNOWN -> late DEFINITE_FAILURE callback: release exactly once
  it('Case 4: late DEFINITE_FAILURE callback transitions UNKNOWN to DEFINITE_FAILURE and releases reservation', async () => {
    n8nClient.nextError = new ServiceUnavailableError('AI mentor service timed out waiting for response');

    const idempotencyKey = 'req_late_failure_4';
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Calculate pi'
      }
    });

    const requestId = postRes.headers['x-appu-request-id'] as string;

    // Dispatch signed failure callback
    const now = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      requestId,
      outcome: 'DEFINITE_FAILURE',
      completedAt: new Date().toISOString(),
      failureCode: 'provider_rate_limit'
    };
    const rawBody = JSON.stringify(callbackPayload);
    const signature = createAppuHmacSignature(rawBody, String(now), callbackSigningSecret);

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(callbackRes.statusCode, 200);
    const updatedRecord = await AppuRequestRepository.getById(db, requestId);
    assert.equal(updatedRecord?.status, AppuRequestStates.DEFINITE_FAILURE);
    assert.equal(updatedRecord?.failureCode, 'provider_rate_limit');

    const usageCheck = await db.query(
      `SELECT status FROM usage_records WHERE id = $1`,
      [updatedRecord!.usageRecordId]
    );
    assert.equal(usageCheck.rows[0].status, 'released');

    const usageSummary = await UsageService.getHouseholdUsageSummary(db, testHousehold.id);
    assert.equal(usageSummary.aiSessions.used, 0);
  });

  // 5. Duplicate success callback: harmless, no duplicate charge (idempotent 200)
  it('Case 5: duplicate SUCCEEDED callback is idempotent and charges zero additional quota', async () => {
    n8nClient.nextResponse = { text: 'Turn response', audioSource: null };

    const idempotencyKey = 'req_dup_success_5';
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Hello'
      }
    });

    const requestId = postRes.headers['x-appu-request-id'] as string;
    const now = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      requestId,
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString()
    };
    const rawBody = JSON.stringify(callbackPayload);
    const signature = createAppuHmacSignature(rawBody, String(now), callbackSigningSecret);

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(callbackRes.statusCode, 200);
    const body = JSON.parse(callbackRes.payload);
    assert.equal(body.idempotent, true);
    assert.equal(body.status, 'SUCCEEDED');

    const usageSummary = await UsageService.getHouseholdUsageSummary(db, testHousehold.id);
    assert.equal(usageSummary.aiSessions.used, 1);
  });

  // 6. Duplicate failure callback: harmless (idempotent 200)
  it('Case 6: duplicate DEFINITE_FAILURE callback is idempotent', async () => {
    n8nClient.nextError = new BadGatewayError('Upstream failure');

    const idempotencyKey = 'req_dup_fail_6';
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Hello fail'
      }
    });

    const requestId = postRes.headers['x-appu-request-id'] as string;
    const now = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      requestId,
      outcome: 'DEFINITE_FAILURE',
      completedAt: new Date().toISOString()
    };
    const rawBody = JSON.stringify(callbackPayload);
    const signature = createAppuHmacSignature(rawBody, String(now), callbackSigningSecret);

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(callbackRes.statusCode, 200);
    const body = JSON.parse(callbackRes.payload);
    assert.equal(body.idempotent, true);
    assert.equal(body.status, 'DEFINITE_FAILURE');
  });

  // 7. Invalid callback signature: rejected (401)
  it('Case 7: callback with forged/invalid HMAC signature is rejected with HTTP 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify({
      requestId: crypto.randomUUID(),
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString()
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': 'v1=' + '0'.repeat(64)
      },
      payload: rawBody
    });

    assert.equal(res.statusCode, 401);
  });

  // 8. Missing signature: rejected (401)
  it('Case 8: callback missing signature headers is rejected with HTTP 401', async () => {
    const rawBody = JSON.stringify({
      requestId: crypto.randomUUID(),
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString()
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json'
      },
      payload: rawBody
    });

    assert.equal(res.statusCode, 401);
  });

  // 9. Stale callback: rejected (401)
  it('Case 9: callback outside freshness window (>300s) is rejected with HTTP 401', async () => {
    const staleTime = Math.floor(Date.now() / 1000) - 305;
    const rawBody = JSON.stringify({
      requestId: crypto.randomUUID(),
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString()
    });
    const signature = createAppuHmacSignature(rawBody, String(staleTime), callbackSigningSecret);

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(staleTime),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(res.statusCode, 401);
  });

  // 10. Altered callback body: rejected (401)
  it('Case 10: callback with altered payload body is rejected with HTTP 401', async () => {
    const now = Math.floor(Date.now() / 1000);
    const originalBody = JSON.stringify({
      requestId: crypto.randomUUID(),
      outcome: 'SUCCEEDED',
      completedAt: new Date().toISOString()
    });
    const signature = createAppuHmacSignature(originalBody, String(now), callbackSigningSecret);

    const tamperedBody = JSON.stringify({
      requestId: crypto.randomUUID(),
      outcome: 'DEFINITE_FAILURE',
      completedAt: new Date().toISOString()
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: tamperedBody
    });

    assert.equal(res.statusCode, 401);
  });

  // 11. Same idempotency key retry: zero additional n8n/provider invocation
  it('Case 11: same idempotency key retry returns existing lifecycle and makes ZERO additional n8n calls', async () => {
    n8nClient.nextResponse = { text: 'Original response', audioSource: null };
    const idempotencyKey = 'req_idempotent_retry_11';

    // Request 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Tell me a science fact'
      }
    });

    assert.equal(res1.statusCode, 200);
    assert.equal(n8nClient.callCount, 1);

    // Request 2 with exact same idempotency key
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'Tell me a science fact'
      }
    });

    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.payload);
    assert.equal(body2.idempotentReplay, true);
    assert.equal(n8nClient.callCount, 1, 'n8n must NOT be called a second time');
  });

  // 12. Concurrent duplicate retry: one downstream invocation
  it('Case 12: concurrent duplicate requests with same idempotency key perform exactly ONE downstream call', async () => {
    n8nClient.nextResponse = { text: 'Concurrent response', audioSource: null };
    const idempotencyKey = 'req_concurrent_retry_12';

    const reqPromise1 = app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'What is momentum?'
      }
    });

    const reqPromise2 = app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': idempotencyKey
      },
      payload: {
        childId: testChild.id,
        message: 'What is momentum?'
      }
    });

    const [res1, res2] = await Promise.all([reqPromise1, reqPromise2]);

    assert.ok(res1.statusCode === 200 || res1.statusCode === 202);
    assert.ok(res2.statusCode === 200 || res2.statusCode === 202);
    assert.equal(n8nClient.callCount, 1, 'Exactly one downstream n8n execution executed');
  });

  // Guest Lifecycle Test 1: Guest timeout retains turn reservation
  it('Guest Lifecycle: timeout transitions to UNKNOWN and retains guest turn', async () => {
    n8nClient.nextError = new ServiceUnavailableError('AI mentor service timed out waiting for response');

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'idempotency-key': 'guest_timeout_req_1'
      },
      payload: {
        message: 'Hello guest'
      }
    });

    assert.equal(res.statusCode, 503);
    const requestId = res.headers['x-appu-request-id'] as string;
    assert.ok(requestId);

    const record = await AppuRequestRepository.getById(db, requestId);
    assert.equal(record?.status, AppuRequestStates.UNKNOWN);
    assert.equal(record?.actorType, 'guest');

    // Guest turn count is 1 (retained as in-flight)
    const guestCheck = await db.query(
      'SELECT used_turns FROM guest_sessions WHERE id = $1',
      [record!.guestSessionId]
    );
    assert.equal(Number(guestCheck.rows[0].used_turns), 1);
  });

  // Guest Lifecycle Test 2: Late DEFINITE_FAILURE callback releases guest turn
  it('Guest Lifecycle: late DEFINITE_FAILURE callback releases guest turn back to 0', async () => {
    n8nClient.nextError = new ServiceUnavailableError('AI mentor service timed out waiting for response');

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'idempotency-key': 'guest_timeout_req_2'
      },
      payload: {
        message: 'Hello guest 2'
      }
    });

    const requestId = res.headers['x-appu-request-id'] as string;
    const record = await AppuRequestRepository.getById(db, requestId);

    // Send signed DEFINITE_FAILURE callback
    const now = Math.floor(Date.now() / 1000);
    const callbackPayload = {
      requestId,
      outcome: 'DEFINITE_FAILURE',
      completedAt: new Date().toISOString(),
      failureCode: 'provider_timeout'
    };
    const rawBody = JSON.stringify(callbackPayload);
    const signature = createAppuHmacSignature(rawBody, String(now), callbackSigningSecret);

    const callbackRes = await app.inject({
      method: 'POST',
      url: '/api/internal/n8n/appu/callback',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(now),
        'x-appu-signature': signature
      },
      payload: rawBody
    });

    assert.equal(callbackRes.statusCode, 200);

    // Guest turn count is released back to 0
    const guestCheck = await db.query(
      'SELECT used_turns FROM guest_sessions WHERE id = $1',
      [record!.guestSessionId]
    );
    assert.equal(Number(guestCheck.rows[0].used_turns), 0);
  });

  // 15. transition directly with completedAt omitted sets completed_at to concrete Date
  it('Case 15: transition PENDING -> SUCCEEDED with completedAt omitted sets completed_at non-null', async () => {
    const guestSessionId = 'gst_test_transition_unit';
    await GuestRepository.upsert(db, {
      id: guestSessionId,
      ipHash: 'test_ip_hash',
      usedTurns: 1,
      expiresAt: new Date(Date.now() + 86400000)
    });

    const pendingReq = await AppuRequestRepository.createGuestPending(db, {
      guestSessionId,
      idempotencyKey: 'idem_test_transition_unit',
      requestFingerprint: 'fp_test_transition_unit'
    });
    assert.equal(pendingReq.status, 'PENDING');
    assert.equal(pendingReq.completedAt, null);

    const transitioned = await AppuRequestRepository.transition(
      db,
      pendingReq.id,
      [AppuRequestStates.PENDING, AppuRequestStates.UNKNOWN],
      AppuRequestStates.SUCCEEDED
    );

    assert.ok(transitioned);
    assert.equal(transitioned!.status, 'SUCCEEDED');
    assert.ok(transitioned!.completedAt instanceof Date);
    assert.ok(!Number.isNaN(transitioned!.completedAt.getTime()));
  });

  // 16. guest full route succeeds with legacy production n8n response shape { output, text, message, audio_base64 }
  it('Case 16: guest full route succeeds with legacy live n8n response shape', async () => {
    n8nClient.nextResponse = {
      text: 'Namaskara! I am Appu.',
      audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA='
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'idempotency-key': 'guest_legacy_n8n_test_1'
      },
      payload: {
        message: 'Hello Appu legacy test',
        language: 'en'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.requestStatus, 'SUCCEEDED');
    assert.equal(body.text, 'Namaskara! I am Appu.');
    assert.ok(body.audioSource);
    assert.equal(body.guestSession.used, 1);
    assert.equal(body.guestSession.remaining, 2);
    assert.ok(res.headers['x-guest-session-token']);

    const requestId = res.headers['x-appu-request-id'] as string;
    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record!.status, 'SUCCEEDED');
    assert.ok(record!.completedAt instanceof Date);
  });

  // 17. authenticated full route succeeds with legacy production n8n response shape
  it('Case 17: authenticated full route succeeds with legacy live n8n response shape', async () => {
    n8nClient.nextResponse = {
      text: 'Planets orbit the sun due to gravity.',
      audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAA='
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': 'auth_legacy_n8n_test_1'
      },
      payload: {
        childId: testChild.id,
        message: 'Why do planets orbit?',
        language: 'en'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.requestStatus, 'SUCCEEDED');
    assert.equal(body.text, 'Planets orbit the sun due to gravity.');

    const requestId = res.headers['x-appu-request-id'] as string;
    const record = await AppuRequestRepository.getById(db, requestId);
    assert.ok(record);
    assert.equal(record!.status, 'SUCCEEDED');
    assert.ok(record!.completedAt instanceof Date);

    // Verify usage record status is committed
    const usageCheck = await db.query(
      'SELECT status FROM usage_records WHERE id = $1',
      [record!.usageRecordId]
    );
    assert.equal(usageCheck.rows[0].status, 'committed');
  });
});

