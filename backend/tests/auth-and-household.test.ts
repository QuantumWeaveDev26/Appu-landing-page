import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { MockAuthVerifier } from '../src/domain/auth/index.js';

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

describe('Milestone 2B: Parent Authentication, Household Authorization & Child Profile APIs', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    authVerifier = new MockAuthVerifier();
    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'silent'
    });

    app = buildApp(config, {
      database: db,
      authVerifier
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // ============================================================================
  // 1. AUTHENTICATION PRE-HANDLER TESTS
  // ============================================================================

  test('missing Authorization header returns 401 UNAUTHORIZED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me'
    });

    assert.equal(res.statusCode, 401);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'unauthorized');
    assert.equal(payload.error.message, 'Missing Authorization header');
  });

  test('malformed Authorization header returns 401 UNAUTHORIZED', async () => {
    // Basic auth format
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Basic user:pass' }
    });
    assert.equal(res1.statusCode, 401);

    // Bare "Bearer" without token
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer' }
    });
    assert.equal(res2.statusCode, 401);

    // Token with extra spaces/parts
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer token extra' }
    });
    assert.equal(res3.statusCode, 401);
  });

  test('invalid/unverified token returns 401 UNAUTHORIZED and does not leak token', async () => {
    const fakeToken = 'invalid-secret-token-12345';
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${fakeToken}` }
    });

    assert.equal(res.statusCode, 401);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'unauthorized');
    // Ensure raw token is never exposed in response body
    assert.equal(res.payload.includes(fakeToken), false);
  });

  // ============================================================================
  // 2. PROTECTED AUTH & HOUSEHOLD ONBOARDING
  // ============================================================================

  test('verified token returns principal and null household prior to onboarding', async () => {
    const userId = crypto.randomUUID();
    const token = 'valid-token-parent-1';
    authVerifier.registerToken(token, { userId, email: 'parent1@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.payload);
    assert.deepEqual(payload, {
      authenticated: true,
      userId,
      household: null
    });
  });

  test('POST /api/household/onboard creates household + OWNER and is idempotent on retry', async () => {
    const userId = crypto.randomUUID();
    const token = 'valid-token-parent-onboard';
    authVerifier.registerToken(token, { userId, email: 'onboard@example.com' });

    // 1. First onboarding call
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: { householdName: 'Reddy Residence' }
    });

    assert.equal(res1.statusCode, 201);
    const payload1 = JSON.parse(res1.payload);
    assert.ok(payload1.household.id);
    assert.equal(payload1.household.name, 'Reddy Residence');
    assert.equal(payload1.role, 'OWNER');
    assert.equal(payload1.isNew, true);

    const householdId = payload1.household.id;

    // 2. GET /api/auth/me now reflects the active household
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(meRes.statusCode, 200);
    const mePayload = JSON.parse(meRes.payload);
    assert.equal(mePayload.household.id, householdId);
    assert.equal(mePayload.household.role, 'OWNER');

    // 3. Retry onboarding: must return existing household without creating duplicates (idempotency)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: { householdName: 'Attempted Duplicate' }
    });

    assert.equal(res2.statusCode, 200);
    const payload2 = JSON.parse(res2.payload);
    assert.equal(payload2.household.id, householdId, 'Must return same household on retry');
    assert.equal(payload2.isNew, false);

    // Verify DB only has 1 household
    const allHouseholds = await db.query('SELECT COUNT(*) AS count FROM households;');
    assert.equal(parseInt(allHouseholds.rows[0].count, 10), 1);
  });

  test('browser-supplied spoofed userId in body cannot override verified principal', async () => {
    const legitUserId = crypto.randomUUID();
    const attackerUserId = crypto.randomUUID();
    const token = 'legit-user-token';
    authVerifier.registerToken(token, { userId: legitUserId });

    // Attacker tries to pass another userId in onboarding body
    const res = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        userId: attackerUserId,
        householdName: 'Hijack Attempt'
      }
    });

    assert.equal(res.statusCode, 201);
    const payload = JSON.parse(res.payload);
    const householdId = payload.household.id;

    // Verify membership in DB was created for legitUserId, NOT attackerUserId
    const members = await db.query('SELECT user_id, role FROM household_members WHERE household_id = $1;', [householdId]);
    assert.equal(members.rows.length, 1);
    assert.equal(members.rows[0].user_id, legitUserId);
    assert.notEqual(members.rows[0].user_id, attackerUserId);
  });

  // ============================================================================
  // 3. PROTECTED CHILD PROFILE APIS
  // ============================================================================

  test('accessing /api/children before onboarding returns 403 FORBIDDEN', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-unboarded-parent';
    authVerifier.registerToken(token, { userId });

    const res = await app.inject({
      method: 'GET',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'forbidden');
  });

  test('POST, GET, and PATCH /api/children CRUD workflow for authorized parent', async () => {
    const userId = crypto.randomUUID();
    const token = 'token-parent-crud';
    authVerifier.registerToken(token, { userId });

    // 1. Onboard parent
    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` },
      payload: { householdName: 'Verma Family' }
    });

    // 2. Create Child 1
    const postRes1 = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredName: 'Aarav',
        gradeBand: 'Grade 6'
      }
    });

    assert.equal(postRes1.statusCode, 201);
    const child1 = JSON.parse(postRes1.payload).child;
    assert.ok(child1.id);
    assert.equal(child1.preferredName, 'Aarav');
    assert.equal(child1.gradeBand, 'Grade 6');
    assert.equal(child1.status, 'ACTIVE');

    // 3. Create Child 2
    const postRes2 = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredName: 'Diya',
        gradeBand: 'Grade 9',
        status: 'ACTIVE'
      }
    });
    assert.equal(postRes2.statusCode, 201);
    const child2 = JSON.parse(postRes2.payload).child;

    // 4. List children
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(listRes.statusCode, 200);
    const listPayload = JSON.parse(listRes.payload);
    assert.equal(listPayload.children.length, 2);
    assert.deepEqual(
      listPayload.children.map((c: any) => c.preferredName).sort(),
      ['Aarav', 'Diya']
    );

    // 5. Get specific child by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${child1.id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(getRes.statusCode, 200);
    const getPayload = JSON.parse(getRes.payload);
    assert.equal(getPayload.child.id, child1.id);
    assert.equal(getPayload.child.preferredName, 'Aarav');

    // 6. Update child
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/children/${child1.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredName: 'Aarav V.',
        gradeBand: 'Grade 7'
      }
    });
    assert.equal(patchRes.statusCode, 200);
    const updatedPayload = JSON.parse(patchRes.payload);
    assert.equal(updatedPayload.child.preferredName, 'Aarav V.');
    assert.equal(updatedPayload.child.gradeBand, 'Grade 7');
  });

  // ============================================================================
  // 4. CROSS-TENANT ADVERSARIAL SECURITY TESTS
  // ============================================================================

  test('ADVERSARIAL: Parent A cannot list, view, or modify Parent B child', async () => {
    // 1. Setup Tenant A
    const parentAId = crypto.randomUUID();
    const tokenA = 'token-parent-A';
    authVerifier.registerToken(tokenA, { userId: parentAId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { householdName: 'Household A' }
    });

    const createChildARes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { preferredName: 'Child A (Rohan)', gradeBand: 'Grade 5' }
    });
    const childA = JSON.parse(createChildARes.payload).child;

    // 2. Setup Tenant B
    const parentBId = crypto.randomUUID();
    const tokenB = 'token-parent-B';
    authVerifier.registerToken(tokenB, { userId: parentBId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { householdName: 'Household B' }
    });

    const createChildBRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { preferredName: 'Child B (Ananya)', gradeBand: 'Grade 9' }
    });
    const childB = JSON.parse(createChildBRes.payload).child;

    // 3. Adversarial Attempt 1: Parent A lists children
    // MUST contain ONLY Child A and zero records of Child B
    const listResA = await app.inject({
      method: 'GET',
      url: '/api/children',
      headers: { authorization: `Bearer ${tokenA}` }
    });
    assert.equal(listResA.statusCode, 200);
    const childrenA = JSON.parse(listResA.payload).children;
    assert.equal(childrenA.length, 1);
    assert.equal(childrenA[0].id, childA.id);
    assert.equal(childrenA.some((c: any) => c.id === childB.id), false);

    // 4. Adversarial Attempt 2: Parent A tries to GET Child B by ID
    // MUST return 404 (NotFoundError) so it never reveals Child B's existence
    const getResCross = await app.inject({
      method: 'GET',
      url: `/api/children/${childB.id}`,
      headers: { authorization: `Bearer ${tokenA}` }
    });
    assert.equal(getResCross.statusCode, 404);
    const getCrossPayload = JSON.parse(getResCross.payload);
    assert.equal(getCrossPayload.error.code, 'not_found');

    // Legitimate lookup by Parent B still succeeds
    const getResLegit = await app.inject({
      method: 'GET',
      url: `/api/children/${childB.id}`,
      headers: { authorization: `Bearer ${tokenB}` }
    });
    assert.equal(getResLegit.statusCode, 200);
    assert.equal(JSON.parse(getResLegit.payload).child.preferredName, 'Child B (Ananya)');

    // 5. Adversarial Attempt 3: Parent A tries to PATCH Child B
    // MUST return 404 and leave Child B completely unmodified
    const patchResCross = await app.inject({
      method: 'PATCH',
      url: `/api/children/${childB.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { preferredName: 'HACKED NAME' }
    });
    assert.equal(patchResCross.statusCode, 404);

    // Verify Child B remains intact in Household B
    const verifyChildB = await app.inject({
      method: 'GET',
      url: `/api/children/${childB.id}`,
      headers: { authorization: `Bearer ${tokenB}` }
    });
    assert.equal(verifyChildB.statusCode, 200);
    assert.equal(JSON.parse(verifyChildB.payload).child.preferredName, 'Child B (Ananya)');
  });
});
