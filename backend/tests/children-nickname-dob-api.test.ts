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

describe('Children & Personalisation Nickname/DOB API (Phase-B Task 3)', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let app: ReturnType<typeof buildApp>;

  let userId: string;
  let token: string;
  let householdId: string;
  let childId: string;

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

    userId = crypto.randomUUID();
    token = `token-${userId}`;
    authVerifier.registerToken(token, { userId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    householdId = JSON.parse(onboardRes.payload).household.id;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aarav',
      gradeBand: 'Grade 6'
    });
    childId = child.id;
  });

  test('Case 1: PUT /api/children/:childId/personalisation saves valid nickname and dob', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredLanguage: 'en',
        nickname: 'Aavu',
        dob: '2014-06-15'
      }
    });

    assert.equal(res.statusCode, 200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(getRes.statusCode, 200);
    const body = JSON.parse(getRes.payload).child;
    assert.equal(body.nickname, 'Aavu');
    assert.equal(body.dob, '2014-06-15');
  });

  test('Case 2: PUT /api/children/:childId/personalisation rejects future DOB with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dob: '2030-01-01'
      }
    });

    assert.equal(res.statusCode, 400);
  });

  test('Case 3: PUT /api/children/:childId/personalisation rejects age under 3 with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dob: '2025-06-01'
      }
    });

    assert.equal(res.statusCode, 400);
  });

  test('Case 4: PUT /api/children/:childId/personalisation rejects age over 25 with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dob: '1990-01-01'
      }
    });

    assert.equal(res.statusCode, 400);
  });

  test('Case 5: PUT /api/children/:childId/personalisation rejects invalid calendar dates with 400', async () => {
    // Non-existent date: Feb 31
    const res1 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dob: '2015-02-31'
      }
    });
    assert.equal(res1.statusCode, 400);

    // Malformed string
    const res2 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        dob: 'not-a-date'
      }
    });
    assert.equal(res2.statusCode, 400);
  });

  test('Case 6: PUT /api/children/:childId/personalisation rejects bad nickname with 400', async () => {
    // Nickname too long (>50 chars)
    const res1 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nickname: 'A'.repeat(51)
      }
    });
    assert.equal(res1.statusCode, 400);

    // Nickname with forbidden characters
    const res2 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nickname: '<script>alert(1)</script>'
      }
    });
    assert.equal(res2.statusCode, 400);
  });

  test('Case 7: PUT /api/children/:childId/personalisation allows clearing nickname and dob with null', async () => {
    // First set them
    await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nickname: 'Aavu',
        dob: '2014-06-15'
      }
    });

    // Then clear them
    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nickname: null,
        dob: null
      }
    });
    assert.equal(clearRes.statusCode, 200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(getRes.statusCode, 200);
    const body = JSON.parse(getRes.payload).child;
    assert.equal(body.nickname, null);
    assert.equal(body.dob, null);
  });

  test('Case 8: PATCH /api/children/:childId accepts and updates nickname and dob', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/children/${childId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nickname: 'Avi',
        dob: '2013-09-22'
      }
    });

    assert.equal(patchRes.statusCode, 200);
    const body = JSON.parse(patchRes.payload).child;
    assert.equal(body.nickname, 'Avi');
    assert.equal(body.dob, '2013-09-22');
  });

  test('Case 9: GET /api/children/:childId returns nickname and dob on child profile', async () => {
    await TenancyRepository.updateChildProfile(db, householdId, childId, {
      nickname: 'Rocky',
      dob: '2012-04-18'
    });

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(getRes.statusCode, 200);
    const body = JSON.parse(getRes.payload).child;
    assert.equal(body.id, childId);
    assert.equal(body.preferredName, 'Aarav');
    assert.equal(body.nickname, 'Rocky');
    assert.equal(body.dob, '2012-04-18');
  });
});
