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
import { PromptsRepository } from '../src/domain/prompts/repository.js';
import { PersonalisationRepository } from '../src/domain/personalisation/repository.js';

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

describe('Prompts REST Endpoints (Phase-C Task 3)', () => {
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
      gradeBand: 'Grade 6',
      nickname: 'Aavu'
    });
    childId = child.id;

    await PersonalisationRepository.upsertPersonalisation(db, householdId, childId, {
      favoriteSubjects: ['Mathematics', 'Science'],
      interests: ['Astronomy', 'Robotics']
    });
  });

  test('Case 1: Requires authentication (401 without token)', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/prompts`
    });
    assert.equal(getRes.statusCode, 401);

    const postRes = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/prompts/regenerate`
    });
    assert.equal(postRes.statusCode, 401);
  });

  test('Case 2: Rejects non-household child or non-existent child with 404', async () => {
    // Other household's child
    const otherUser = crypto.randomUUID();
    const otherToken = `token-${otherUser}`;
    authVerifier.registerToken(otherToken, { userId: otherUser });

    const otherOnboard = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${otherToken}` }
    });
    const otherHouseholdId = JSON.parse(otherOnboard.payload).household.id;

    const otherChild = await TenancyRepository.createChildProfile(db, {
      householdId: otherHouseholdId,
      preferredName: 'Diya',
      gradeBand: 'Grade 8'
    });

    // Parent A requests Child B
    const crossRes = await app.inject({
      method: 'GET',
      url: `/api/children/${otherChild.id}/prompts`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(crossRes.statusCode, 404);

    // Random non-existent UUID
    const randomUuid = crypto.randomUUID();
    const notFoundRes = await app.inject({
      method: 'GET',
      url: `/api/children/${randomUuid}/prompts`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(notFoundRes.statusCode, 404);
  });

  test('Case 3: GET lazy-generates and returns prompts for initialized child', async () => {
    // Ensure DB is initially empty of prompts
    const priorInDb = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(priorInDb.length, 0);

    const res = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/prompts`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.prompts));
    assert.equal(body.prompts.length, 16);

    // Verify persisted in DB
    const afterInDb = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(afterInDb.length, 16);
    assert.equal(afterInDb[0].id, body.prompts[0].id);

    // Second GET returns the exact same cached prompts
    const secondRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/prompts`,
      headers: { authorization: `Bearer ${token}` }
    });
    const secondBody = JSON.parse(secondRes.payload);
    assert.equal(secondBody.prompts.length, 16);
    assert.equal(secondBody.prompts[0].id, body.prompts[0].id);
  });

  test('Case 4: POST /api/children/:childId/prompts/regenerate regenerates and returns updated prompts', async () => {
    // Initial fetch
    const firstRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/prompts`,
      headers: { authorization: `Bearer ${token}` }
    });
    const firstBody = JSON.parse(firstRes.payload);
    const firstIds = new Set(firstBody.prompts.map((p: any) => p.id));

    // Regenerate
    const regenRes = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/prompts/regenerate`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(regenRes.statusCode, 200);
    const regenBody = JSON.parse(regenRes.payload);
    assert.ok(Array.isArray(regenBody.prompts));
    assert.equal(regenBody.prompts.length, 16);

    // Every regenerated prompt has a new ID
    for (const p of regenBody.prompts) {
      assert.ok(!firstIds.has(p.id), `Expected new ID, but got existing ID: ${p.id}`);
    }

    // Verify DB only has 16 items
    const inDb = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    assert.equal(inDb.length, 16);
    assert.equal(inDb[0].id, regenBody.prompts[0].id);
  });

  test('Case 5: Category query filter returns only requested category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/prompts?category=quick_concepts`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.prompts));
    assert.equal(body.prompts.length, 4);

    for (const p of body.prompts) {
      assert.equal(p.category, 'quick_concepts');
    }
  });
});
