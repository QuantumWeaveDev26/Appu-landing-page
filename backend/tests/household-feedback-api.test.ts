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
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  };

  return db;
}

describe('Household Feedback API Endpoints', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let app: ReturnType<typeof buildApp>;
  let userId: string;
  const token = 'token-parent-123';

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    userId = crypto.randomUUID();
    authVerifier = new MockAuthVerifier();
    authVerifier.registerToken(token, {
      userId,
      email: 'parent@example.com'
    });

    const config = loadConfig({
      NODE_ENV: 'test',
      APPU_BETA_MODE: 'true',
      APPU_BETA_CHAT_LIMIT: '30'
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient: new MockRazorpayClient({ keyId: 'test', keySecret: 'test' }),
      n8nClient: new MockN8nClient()
    });

    // Create household and member
    const household = await TenancyRepository.createHousehold(db, { name: 'Gupta Family' });
    await TenancyRepository.createHouseholdMember(db, {
      householdId: household.id,
      userId,
      role: 'OWNER'
    });
  });

  test('GET /api/household/feedback rejects unauthenticated request with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/household/feedback'
    });

    assert.equal(res.statusCode, 401);
  });

  test('GET /api/household/feedback returns not submitted before feedback', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.submitted, false);
    assert.equal(body.reportsUnlocked, false);
    assert.equal(body.feedback, null);
  });

  test('POST /api/household/feedback validates rating bounds', async () => {
    const resUnder = await app.inject({
      method: 'POST',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        rating: 0
      })
    });

    assert.equal(resUnder.statusCode, 400);

    const resOver = await app.inject({
      method: 'POST',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        rating: 6
      })
    });

    assert.equal(resOver.statusCode, 400);
  });

  test('POST /api/household/feedback saves feedback and unlocks reports', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        rating: 5,
        whatsWorking: 'Appu explains fractions clearly.',
        whatsToImprove: 'Provide weekly recap emails.'
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.reportsUnlocked, true);
    assert.equal(body.feedback.rating, 5);
    assert.equal(body.feedback.whatsWorking, 'Appu explains fractions clearly.');
    assert.equal(body.feedback.whatsToImprove, 'Provide weekly recap emails.');

    // Verify GET now returns submitted=true and reportsUnlocked=true
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(getRes.statusCode, 200);
    const getBody = JSON.parse(getRes.body);
    assert.equal(getBody.submitted, true);
    assert.equal(getBody.reportsUnlocked, true);
    assert.equal(getBody.feedback.rating, 5);
  });

  test('POST /api/household/feedback rejects empty whatsWorking or whatsToImprove with 400', async () => {
    const resNoWorking = await app.inject({
      method: 'POST',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        rating: 5,
        whatsWorking: '   ',
        whatsToImprove: 'Quizzes'
      })
    });
    assert.equal(resNoWorking.statusCode, 400);

    const resNoImprove = await app.inject({
      method: 'POST',
      url: '/api/household/feedback',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        rating: 5,
        whatsWorking: 'Great',
        whatsToImprove: ''
      })
    });
    assert.equal(resNoImprove.statusCode, 400);
  });
});
