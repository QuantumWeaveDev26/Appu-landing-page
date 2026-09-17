import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../src/domain/auth/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { ParentalControlsService, sanitizeMetaParam } from '../src/domain/parental-controls/index.js';

class TestAuthVerifier implements AuthVerifier {
  private users = new Map<string, AuthenticatedPrincipal>();
  registerUser(token: string, principal: AuthenticatedPrincipal) {
    this.users.set(token, principal);
  }
  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    const user = this.users.get(token);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return user;
  }
}

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

  memDb.public.registerFunction({
    name: 'hashtext',
    args: [memDb.public.getType('text')],
    returns: memDb.public.getType('int'),
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

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const cleanQuery = (text: string, params?: any[]) => {
    let t = text;
    if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
      t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
    }
    return pool.query(t, params);
  };

  const db: TransactionalQueryable = {
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await cleanQuery(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount
      };
    },

    async transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const clientQuery = (text: string, params?: any[]) => {
          let t = text;
          if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
            t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
          }
          return client.query(t, params);
        };
        const transactionDb: Queryable = {
          async query<TResult = any>(queryText: string, values: any[] = []) {
            const result = await clientQuery(queryText, values);
            return {
              rows: result.rows as TResult[],
              rowCount: result.rowCount
            };
          }
        };
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

describe('APPU Parental Controls & WhatsApp Dispatch Suite', () => {
  let db: TransactionalQueryable;
  let authVerifier: TestAuthVerifier;
  let householdId: string;
  let childId: string;
  let foreignHouseholdId: string;
  let foreignChildId: string;
  const parentUserId = crypto.randomUUID();
  const foreignUserId = crypto.randomUUID();
  const authHeaders = { authorization: 'Bearer token_parent_owner' };
  let capturedWebhooks: Array<{
    url: string;
    payload: any;
    headers?: Record<string, string>;
    rawBody?: string;
  }> = [];

  const mockFetch = (async (url: any, init: any) => {
    capturedWebhooks.push({
      url: String(url),
      payload: JSON.parse(init?.body || '{}'),
      headers: init?.headers,
      rawBody: init?.body
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  }) as unknown as typeof fetch;

  beforeEach(async () => {
    capturedWebhooks = [];
    db = createTestDatabase();
    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    authVerifier.registerUser('token_parent_owner', {
      userId: parentUserId,
      email: 'parent@test.com'
    });
    authVerifier.registerUser('token_foreign_owner', {
      userId: foreignUserId,
      email: 'foreign@test.com'
    });

    const setup = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'parent@test.com',
      householdName: 'Sharma Household'
    });
    householdId = setup.household.id;

    const childRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, 'Aarav', 'Grade 5') RETURNING id`,
      [householdId]
    );
    childId = childRes.rows[0].id;

    const foreignSetup = await TenancyService.createHouseholdWithOwner(db, {
      userId: foreignUserId,
      email: 'foreign@test.com',
      householdName: 'Verma Household'
    });
    foreignHouseholdId = foreignSetup.household.id;

    const foreignChildRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, 'Rohan', 'Grade 6') RETURNING id`,
      [foreignHouseholdId]
    );
    foreignChildId = foreignChildRes.rows[0].id;
  });

  test('sanitizeMetaParam collapses newlines, strips whitespace, and truncates smoothly', () => {
    const multiline = 'Line 1\n\nLine 2\r\nLine 3\tTab';
    const sanitized = sanitizeMetaParam(multiline, 100);
    assert.equal(sanitized, 'Line 1 Line 2 Line 3 Tab');
    assert.equal(sanitized.includes('\n'), false);
    assert.equal(sanitized.includes('\r'), false);

    const longText = 'a'.repeat(200);
    const truncated = sanitizeMetaParam(longText, 50);
    assert.equal(truncated.length, 50);
    assert.ok(truncated.endsWith('...'));
  });

  test('when APPU_PARENTAL_CONTROLS_ENABLED is false, endpoints remain safe and disabled', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_PARENTAL_CONTROLS_ENABLED: 'false'
    });

    const app = buildApp(config, {
      database: db as any,
      authVerifier
    });

    // 1. Heartbeat returns disabled
    const hbRes = await app.inject({
      method: 'POST',
      url: '/api/appu/session/heartbeat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_1',
        childId,
        activeMsSinceLast: 15000,
        awayMsSinceLast: 5000
      }
    });
    assert.equal(hbRes.statusCode, 200);
    assert.deepEqual(hbRes.json(), {
      enabled: false,
      locked: false,
      activeSeconds: 0,
      awaySeconds: 0,
      timeRemainingSeconds: 1800
    });

    // 2. OTP request returns disabled
    const otpRes = await app.inject({
      method: 'POST',
      url: '/api/appu/session/otp/request',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_1',
        childId
      }
    });
    assert.equal(otpRes.statusCode, 200);
    assert.deepEqual(otpRes.json(), {
      requested: false,
      error: 'parental_controls_disabled'
    });

    // 3. OTP verify returns disabled
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/appu/session/otp/verify',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_1',
        childId,
        code: '123456'
      }
    });
    assert.equal(verifyRes.statusCode, 200);
    assert.deepEqual(verifyRes.json(), {
      verified: false,
      error: 'parental_controls_disabled'
    });

    // 4. Session usage returns disabled
    const usageRes = await app.inject({
      method: 'GET',
      url: `/api/appu/session/usage?sessionId=sess_1&childId=${childId}`,
      headers: authHeaders
    });
    assert.equal(usageRes.statusCode, 200);
    assert.deepEqual(usageRes.json(), {
      enabled: false,
      locked: false,
      activeSeconds: 0,
      awaySeconds: 0,
      timeRemainingSeconds: 1800
    });
  });

  test('POST /api/appu/notes/send-whatsapp gates on parent phone and WhatsApp consent', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      N8N_WHATSAPP_TEMPLATE_WEBHOOK_URL: 'https://n8n.test/webhook/whatsapp-send',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_secret_that_is_at_least_32_characters_long_for_hmac'
    });

    const app = buildApp(config, {
      database: db as any,
      authVerifier
    });

    // Case 1: No phone configured -> needsPhone: true
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/notes/send-whatsapp',
      headers: authHeaders,
      payload: {
        childId,
        note: 'Important formula: Area of circle is pi*r^2'
      }
    });
    assert.equal(res1.statusCode, 200);
    assert.deepEqual(res1.json(), {
      sent: false,
      needsPhone: true
    });

    // Case 2: Phone configured but consent revoked -> needsPhone: true
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: false
    });

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/notes/send-whatsapp',
      headers: authHeaders,
      payload: {
        childId,
        note: 'Important formula: Area of circle is pi*r^2'
      }
    });
    assert.equal(res2.statusCode, 200);
    assert.deepEqual(res2.json(), {
      sent: false,
      needsPhone: true
    });

    // Case 3: Phone and consent present -> sends template appu_study_note
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/appu/notes/send-whatsapp',
        headers: authHeaders,
        payload: {
          childId,
          note: 'Step 1:\nSolve the denominator.\nStep 2:\nMultiply across.'
        }
      });
      assert.equal(res3.statusCode, 200);
      assert.deepEqual(res3.json(), { sent: true });

      assert.equal(capturedWebhooks.length, 1);
      assert.equal(capturedWebhooks[0].url, 'https://n8n.test/webhook/whatsapp-send');
      assert.equal(capturedWebhooks[0].payload.recipientPhone, '+919876543210');
      assert.equal(capturedWebhooks[0].payload.templateName, 'appu_study_note');
      assert.deepEqual(capturedWebhooks[0].payload.parameters, [
        { type: 'text', text: 'Aarav' },
        { type: 'text', text: 'Step 1: Solve the denominator. Step 2: Multiply across.' }
      ]);
      assert.ok(capturedWebhooks[0].headers?.['X-APPU-Timestamp']);
      assert.ok(capturedWebhooks[0].headers?.['X-APPU-Signature']?.startsWith('v1='));
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('heartbeat accumulates active/away duration and triggers lock when threshold is exceeded', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_PARENTAL_CONTROLS_ENABLED: 'true',
      APPU_PARENTAL_LOCK_INTERVAL_SECONDS: '100' // test with short 100-second window
    });

    const app = buildApp(config, {
      database: db as any,
      authVerifier
    });

    // 1. Send first heartbeat (40s active, 10s away)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/session/heartbeat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_lock_test',
        childId,
        activeMsSinceLast: 40000,
        awayMsSinceLast: 10000
      }
    });
    assert.equal(res1.statusCode, 200);
    assert.deepEqual(res1.json(), {
      enabled: true,
      locked: false,
      activeSeconds: 40,
      awaySeconds: 10,
      timeRemainingSeconds: 60
    });

    // 2. Send second heartbeat (40s active, 5s away) -> total 80s active
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/session/heartbeat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_lock_test',
        childId,
        activeMsSinceLast: 40000,
        awayMsSinceLast: 5000
      }
    });
    assert.equal(res2.statusCode, 200);
    assert.deepEqual(res2.json(), {
      enabled: true,
      locked: false,
      activeSeconds: 80,
      awaySeconds: 15,
      timeRemainingSeconds: 20
    });

    // 3. Send third heartbeat (30s active) -> total 110s active -> crosses 100s threshold!
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/appu/session/heartbeat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_lock_test',
        childId,
        activeMsSinceLast: 30000,
        awayMsSinceLast: 0
      }
    });
    assert.equal(res3.statusCode, 200);
    assert.deepEqual(res3.json(), {
      enabled: true,
      locked: true,
      activeSeconds: 110,
      awaySeconds: 15,
      timeRemainingSeconds: 0
    });

    // 4. GET /api/appu/session/usage verifies lock persists
    const usageRes = await app.inject({
      method: 'GET',
      url: `/api/appu/session/usage?sessionId=sess_lock_test&childId=${childId}`,
      headers: authHeaders
    });
    assert.equal(usageRes.statusCode, 200);
    assert.deepEqual(usageRes.json(), {
      enabled: true,
      locked: true,
      activeSeconds: 110,
      awaySeconds: 15,
      timeRemainingSeconds: 0
    });
  });

  test('OTP request, rate-limiting, and verification resets the usage window', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_PARENTAL_CONTROLS_ENABLED: 'true',
      APPU_PARENTAL_LOCK_INTERVAL_SECONDS: '100',
      N8N_WHATSAPP_TEMPLATE_WEBHOOK_URL: 'https://n8n.test/webhook/whatsapp-send',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_secret_that_is_at_least_32_characters_long_for_hmac'
    });

    const app = buildApp(config, {
      database: db as any,
      authVerifier
    });

    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // Seed session usage at 120s active (locked)
    await ParentalControlsService.recordHeartbeat(
      db,
      householdId,
      {
        sessionId: 'sess_otp_test',
        childId,
        activeMsSinceLast: 120000,
        awayMsSinceLast: 30000
      },
      { enabled: true, lockIntervalSeconds: 100 }
    );

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;

    try {
      // 1. Request OTP
      const otpReqRes = await app.inject({
        method: 'POST',
        url: '/api/appu/session/otp/request',
        headers: authHeaders,
        payload: {
          sessionId: 'sess_otp_test',
          childId
        }
      });
      assert.equal(otpReqRes.statusCode, 200);
      const reqData = otpReqRes.json();
      assert.equal(reqData.requested, true);
      assert.equal(reqData.expiresInSeconds, 600);
      assert.equal(reqData.activeSeconds, 120);
      assert.equal(reqData.awaySeconds, 30);
      // Ensure plain OTP is NOT leaked in response
      assert.equal(reqData.code, undefined);
      assert.equal(reqData.otp, undefined);

      // Verify two templates were dispatched: appu_parent_otp and appu_screentime_report
      assert.equal(capturedWebhooks.length, 2);
      const otpCall = capturedWebhooks.find((w) => w.payload.templateName === 'appu_parent_otp');
      const reportCall = capturedWebhooks.find((w) => w.payload.templateName === 'appu_screentime_report');

      assert.ok(otpCall);
      assert.ok(otpCall.headers?.['X-APPU-Timestamp']);
      assert.ok(otpCall.headers?.['X-APPU-Signature']?.startsWith('v1='));
      assert.equal(otpCall.payload.recipientPhone, '+919876543210');
      assert.equal(otpCall.payload.templateLanguage, 'en');
      assert.equal(otpCall.payload.components.length, 2);
      assert.equal(otpCall.payload.components[0].type, 'body');
      assert.match(otpCall.payload.components[0].parameters[0].text, /^\d{6}$/);
      const sentCode = otpCall.payload.components[0].parameters[0].text;

      // Also verify copy_code button component
      assert.deepEqual(otpCall.payload.components[1], {
        type: 'button',
        sub_type: 'copy_code',
        index: '0',
        parameters: [{ type: 'coupon_code', coupon_code: sentCode }]
      });

      assert.ok(reportCall);
      assert.ok(reportCall.headers?.['X-APPU-Timestamp']);
      assert.ok(reportCall.headers?.['X-APPU-Signature']?.startsWith('v1='));
      assert.deepEqual(reportCall.payload.parameters, [
        { type: 'text', text: 'Aarav' },
        { type: 'text', text: '2' }, // 120s = 2 min
        { type: 'text', text: '1' }  // 30s = 1 min
      ]);

      // 2. Verify with incorrect code -> fails with attemptsLeft: 4
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/appu/session/otp/verify',
        headers: authHeaders,
        payload: {
          sessionId: 'sess_otp_test',
          childId,
          code: '000000'
        }
      });
      assert.equal(failRes.statusCode, 200);
      assert.deepEqual(failRes.json(), {
        verified: false,
        attemptsLeft: 4
      });

      // 3. Verify with correct code -> succeeds and resets window
      const succRes = await app.inject({
        method: 'POST',
        url: '/api/appu/session/otp/verify',
        headers: authHeaders,
        payload: {
          sessionId: 'sess_otp_test',
          childId,
          code: sentCode
        }
      });
      assert.equal(succRes.statusCode, 200);
      assert.deepEqual(succRes.json(), {
        verified: true,
        windowReset: true
      });

      // 4. Check usage after reset -> activeSeconds should be 0, locked: false!
      const postUsageRes = await app.inject({
        method: 'GET',
        url: `/api/appu/session/usage?sessionId=sess_otp_test&childId=${childId}`,
        headers: authHeaders
      });
      assert.equal(postUsageRes.statusCode, 200);
      assert.deepEqual(postUsageRes.json(), {
        enabled: true,
        locked: false,
        activeSeconds: 0,
        awaySeconds: 0,
        timeRemainingSeconds: 100
      });

      // 5. Verify rate limiting: 4 more requests brings total to 5
      for (let i = 0; i < 4; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/appu/session/otp/request',
          headers: authHeaders,
          payload: { sessionId: 'sess_otp_test', childId }
        });
      }

      // 6th request within 1 hour must be rate-limited
      const rateLimitedRes = await app.inject({
        method: 'POST',
        url: '/api/appu/session/otp/request',
        headers: authHeaders,
        payload: { sessionId: 'sess_otp_test', childId }
      });
      assert.equal(rateLimitedRes.statusCode, 200);
      assert.deepEqual(rateLimitedRes.json(), {
        requested: false,
        error: 'rate_limited',
        retryAfterSeconds: 300
      });
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('adversarial check: parent cannot access or heartbeat for child of another household', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_PARENTAL_CONTROLS_ENABLED: 'true'
    });

    const app = buildApp(config, {
      database: db as any,
      authVerifier
    });

    // Parent A tries to heartbeat for Child B
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/session/heartbeat',
      headers: authHeaders,
      payload: {
        sessionId: 'sess_cross_tenant',
        childId: foreignChildId,
        activeMsSinceLast: 10000,
        awayMsSinceLast: 0
      }
    });
    assert.equal(res.statusCode, 404);
  });
});
