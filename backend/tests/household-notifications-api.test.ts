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
import { MockN8nClient } from '../src/domain/gateway/index.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { SubscriptionService } from '../src/domain/subscription/service.js';

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
      const transactionDb: Queryable = {
        async query<TResult = any>(queryText: string, values: any[] = []) {
          const res = await cleanQuery(queryText, values);
          return {
            rows: res.rows as TResult[],
            rowCount: res.rowCount
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

describe('Household Notifications REST API & Personalisation Handoff', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    await SubscriptionService.syncPlans(db, {
      evolve_monthly: 'plan_evolve_mo_test',
      evolve_annual: 'plan_evolve_yr_test',
      evolve_plus_monthly: 'plan_evolve_plus_mo_test',
      evolve_plus_annual: 'plan_evolve_plus_yr_test',
      genesis_monthly: 'plan_genesis_mo_test',
      genesis_annual: 'plan_genesis_yr_test'
    });

    authVerifier = new MockAuthVerifier();
    razorpayClient = new MockRazorpayClient();
    n8nClient = new MockN8nClient();

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      RAZORPAY_KEY_ID: 'rzp_test_mockKeyId',
      RAZORPAY_KEY_SECRET: 'mock_secret_key',
      RAZORPAY_WEBHOOK_SECRET: 'mock_webhook_secret',
      RAZORPAY_PLAN_MAPPINGS: JSON.stringify({
        evolve_monthly: 'plan_evolve_mo_test',
        evolve_annual: 'plan_evolve_yr_test',
        evolve_plus_monthly: 'plan_evolve_plus_mo_test',
        evolve_plus_annual: 'plan_evolve_plus_yr_test',
        genesis_monthly: 'plan_genesis_mo_test',
        genesis_annual: 'plan_genesis_yr_test'
      }),
      N8N_WEBHOOK_URL: 'https://n8n.test/webhook/mock'
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient,
      n8nClient
    });
  });

  test('GET /api/household/notifications requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/household/notifications'
    });
    assert.equal(res.statusCode, 401);
  });

  test('GET /api/household/notifications returns default null/false state for onboarded household', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-notifications-default';
    authVerifier.registerToken(token, { userId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(onboardRes.statusCode, 201);

    const res = await app.inject({
      method: 'GET',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.parentPhone, null);
    assert.equal(body.whatsappConsent, false);
    assert.equal(body.whatsappConsentAt, null);
  });

  test('PATCH /api/household/notifications updates phone and grants WhatsApp consent', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-notifications-update';
    authVerifier.registerToken(token, { userId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    // Update with 10-digit Indian phone and consent true
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        parentPhone: '9876543210',
        whatsappConsent: true
      }
    });

    assert.equal(patchRes.statusCode, 200);
    const updated = JSON.parse(patchRes.payload);
    assert.equal(updated.parentPhone, '+919876543210');
    assert.equal(updated.whatsappConsent, true);
    assert.ok(updated.whatsappConsentAt);

    // Verify GET reflects the update
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` }
    });
    const fetched = JSON.parse(getRes.payload);
    assert.equal(fetched.parentPhone, '+919876543210');
    assert.equal(fetched.whatsappConsent, true);
    assert.ok(fetched.whatsappConsentAt);
  });

  test('PATCH /api/household/notifications rejects consent without phone', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-notifications-no-phone';
    authVerifier.registerToken(token, { userId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        whatsappConsent: true
      }
    });

    assert.equal(res.statusCode, 400);
  });

  test('PATCH /api/household/notifications rejects invalid phone number format', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-notifications-invalid-phone';
    authVerifier.registerToken(token, { userId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        parentPhone: 'not-a-valid-phone-123',
        whatsappConsent: false
      }
    });

    assert.equal(res.statusCode, 400);
  });

  test('PATCH /api/household/notifications revoking consent preserves phone and clears timestamp', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-notifications-revoke';
    authVerifier.registerToken(token, { userId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    // First grant
    await app.inject({
      method: 'PATCH',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        parentPhone: '+919876543210',
        whatsappConsent: true
      }
    });

    // Then revoke
    const revokeRes = await app.inject({
      method: 'PATCH',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        whatsappConsent: false
      }
    });

    assert.equal(revokeRes.statusCode, 200);
    const body = JSON.parse(revokeRes.payload);
    assert.equal(body.parentPhone, '+919876543210');
    assert.equal(body.whatsappConsent, false);
    assert.equal(body.whatsappConsentAt, null);
  });

  test('PUT /api/children/:childId/personalisation optionally updates household notification preferences', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-personalisation-whatsapp';
    authVerifier.registerToken(token, { userId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aanya',
      gradeBand: 'Grade 5'
    });

    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/children/${child.id}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredLanguage: 'kn',
        learningStyle: 'visual',
        parentPhone: '9876543210',
        whatsappConsent: true
      }
    });

    assert.equal(putRes.statusCode, 200);

    // Verify child personalisation was saved
    const pers = JSON.parse(putRes.payload).personalisation;
    assert.equal(pers.preferredLanguage, 'kn');
    assert.equal(pers.learningStyle, 'visual');

    // Verify household notifications were updated in the same request
    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/household/notifications',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(notifRes.statusCode, 200);
    const notif = JSON.parse(notifRes.payload);
    assert.equal(notif.parentPhone, '+919876543210');
    assert.equal(notif.whatsappConsent, true);
    assert.ok(notif.whatsappConsentAt);
  });
});
