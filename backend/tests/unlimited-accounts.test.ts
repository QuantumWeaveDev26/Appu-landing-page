import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import {
  isUnlimitedEmail,
  parseUnlimitedEmails,
  ensureUnlimitedSubscription,
  DEFAULT_UNLIMITED_EMAILS
} from '../src/domain/entitlements/unlimited-service.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../src/domain/auth/types.js';
import type { TransactionalQueryable } from '../src/db/types.js';
import type { N8nClient, N8nMessageResponse } from '../src/domain/gateway/index.js';

class TestAuthVerifier implements AuthVerifier {
  private users = new Map<string, AuthenticatedPrincipal>();

  registerUser(token: string, principal: AuthenticatedPrincipal) {
    this.users.set(token, principal);
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    const principal = this.users.get(token);
    if (!principal) {
      throw new Error('Invalid token');
    }
    return principal;
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
    name: 'pg_advisory_xact_lock',
    args: [memDb.public.getType('text')],
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

    async transaction<T>(work: (client: TransactionalQueryable) => Promise<T>): Promise<T> {
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
        const transactionDb: TransactionalQueryable = {
          async query<TResult = any>(queryText: string, values: any[] = []) {
            const result = await clientQuery(queryText, values);
            return {
              rows: result.rows as TResult[],
              rowCount: result.rowCount
            };
          },
          transaction: (w) => w(transactionDb)
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

describe('Admin Unlimited Accounts & Server-Side Allowlist Suite', () => {
  let db: TransactionalQueryable;
  let authVerifier: TestAuthVerifier;

  const adminEmail1 = 'ceo@brandmintai.io';
  const adminEmail2 = 'vishak.b7@gmail.com';
  const adminEmail3 = 'naveenreddy95190@gmail.com';
  const adminEmail4 = 'kaaranji@brandmintai.io';
  const regularEmail = 'regular.parent@example.com';

  const adminUserId1 = crypto.randomUUID();
  const regularUserId = crypto.randomUUID();

  const adminAuthHeaders = { authorization: 'Bearer token_admin_ceo' };
  const regularAuthHeaders = { authorization: 'Bearer token_regular_parent' };

  let mockN8nClient: N8nClient;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    authVerifier.registerUser('token_admin_ceo', {
      userId: adminUserId1,
      email: adminEmail1
    });
    authVerifier.registerUser('token_regular_parent', {
      userId: regularUserId,
      email: regularEmail
    });

    mockN8nClient = {
      sendMessage: async (): Promise<N8nMessageResponse> => ({
        text: 'Hello from APPU mentor!',
        audioBase64: null,
        audioDurationMs: null
      })
    };
  });

  test('unit: isUnlimitedEmail matches case-insensitively and whitespace-trimmed across all 4 requested emails', () => {
    assert.equal(isUnlimitedEmail('ceo@brandmintai.io'), true);
    assert.equal(isUnlimitedEmail('CEO@BRANDMINTAI.IO'), true);
    assert.equal(isUnlimitedEmail('  ceo@brandmintai.io  '), true);

    assert.equal(isUnlimitedEmail('vishak.b7@gmail.com'), true);
    assert.equal(isUnlimitedEmail('Vishak.B7@Gmail.Com'), true);

    assert.equal(isUnlimitedEmail('naveenreddy95190@gmail.com'), true);
    assert.equal(isUnlimitedEmail('NAVEENREDDY95190@GMAIL.COM'), true);

    assert.equal(isUnlimitedEmail('kaaranji@brandmintai.io'), true);
    assert.equal(isUnlimitedEmail('Kaaranji@BrandMintAI.io'), true);

    // Negative cases: unauthorized emails
    assert.equal(isUnlimitedEmail('hacker@brandmintai.io'), false);
    assert.equal(isUnlimitedEmail('naveen95190@gmail.com'), false); // deleted old account, must NOT match
    assert.equal(isUnlimitedEmail('other@gmail.com'), false);
    assert.equal(isUnlimitedEmail(''), false);
    assert.equal(isUnlimitedEmail(null), false);
    assert.equal(isUnlimitedEmail(undefined), false);
  });

  test('unit: ensureUnlimitedSubscription provisions unlimited plan, entitlements and 100-year active subscription', async () => {
    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: adminUserId1,
      householdName: 'Admin Household'
    });

    await ensureUnlimitedSubscription(db, household.id);

    const subRes = await db.query<any>(
      `SELECT s.status, s.provider, p.code, p.amount_paise
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.household_id = $1`,
      [household.id]
    );

    assert.equal(subRes.rows.length, 1);
    assert.equal(subRes.rows[0].status, 'ACTIVE');
    assert.equal(subRes.rows[0].code, 'unlimited');
    assert.equal(Number(subRes.rows[0].amount_paise), 0);

    const entRes = await db.query<any>(
      `SELECT entitlement_key, value FROM plan_entitlements
       WHERE plan_id = (SELECT id FROM plans WHERE code = 'unlimited')`
    );

    const entMap = new Map(entRes.rows.map((r) => [r.entitlement_key, r.value]));
    assert.equal(entMap.get('monthly_ai_sessions'), 999999999);
    assert.equal(entMap.get('monthly_voice_minutes'), 999999999);
    assert.equal(entMap.get('max_children'), 999);

    // Idempotency check: running again does not throw or duplicate
    await ensureUnlimitedSubscription(db, household.id);
    const subRes2 = await db.query('SELECT COUNT(*) as count FROM subscriptions WHERE household_id = $1', [household.id]);
    assert.equal(Number(subRes2.rows[0].count), 1);
  });

  test('integration: allowlisted admin account bypasses paid subscription check on POST /api/appu/message', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_BETA_MODE: 'false' // BETA OFF -> Normal users MUST pay for subscription
    });

    const app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient
    });

    // 1. Regular parent tries to chat without active subscription -> 403 Forbidden
    const regularOnboard = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: regularAuthHeaders,
      payload: { householdName: 'Regular Household' }
    });
    assert.equal(regularOnboard.statusCode, 201);
    const regularHhId = regularOnboard.json().household.id;

    const childRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, 'Regular Kid', 'Grade 4') RETURNING id`,
      [regularHhId]
    );
    const regularChildId = childRes.rows[0].id;

    const regularChatRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: regularAuthHeaders,
      payload: {
        childId: regularChildId,
        message: 'Can you help me with fractions?'
      }
    });
    // Forbidden because no paid subscription
    assert.equal(regularChatRes.statusCode, 403);
    assert.match(regularChatRes.json().message || regularChatRes.json().error?.message, /subscription is required/i);

    // 2. Allowlisted admin account (ceo@brandmintai.io) onboards and chats -> 200 OK without paying!
    const adminOnboard = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: adminAuthHeaders,
      payload: { householdName: 'CEO Household' }
    });
    assert.equal(adminOnboard.statusCode, 201);
    const adminHhId = adminOnboard.json().household.id;

    const adminChildRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, 'Admin Child', 'Grade 7') RETURNING id`,
      [adminHhId]
    );
    const adminChildId = adminChildRes.rows[0].id;

    const adminChatRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: adminAuthHeaders,
      payload: {
        childId: adminChildId,
        message: 'Explain Newton third law with cricket analogies'
      }
    });

    assert.equal(adminChatRes.statusCode, 200);
    assert.equal(adminChatRes.json().text, 'Hello from APPU mentor!');

    // Verify the subscription table now has an ACTIVE 'unlimited' subscription for the admin household
    const adminSub = await db.query<any>(
      `SELECT s.status, p.code FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.household_id = $1`,
      [adminHhId]
    );
    assert.equal(adminSub.rows[0].status, 'ACTIVE');
    assert.equal(adminSub.rows[0].code, 'unlimited');
  });

  test('integration: allowlisted admin can chat without providing childId (auto-provisions default child)', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_BETA_MODE: 'false'
    });

    const app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient
    });

    // Admin has household but NO children yet
    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: adminAuthHeaders,
      payload: { householdName: 'Fresh Admin Household' }
    });

    // Chat without childId in payload
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: adminAuthHeaders,
      payload: {
        message: 'Direct admin chat without prior onboarding'
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().text, 'Hello from APPU mentor!');
    assert.ok(res.json().childId, 'Must have auto-resolved/created childId');
  });

  test('integration: allowlisted admin account bypasses max_children limit on POST /api/children', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_BETA_MODE: 'false'
    });

    const app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient
    });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: adminAuthHeaders,
      payload: { householdName: 'Family Household' }
    });

    // Can create 4 children without hitting any plan restrictions
    for (let i = 1; i <= 4; i++) {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/children',
        headers: adminAuthHeaders,
        payload: {
          preferredName: `Child ${i}`,
          gradeBand: `Grade ${i}`
        }
      });
      assert.equal(createRes.statusCode, 201);
    }
  });

  test('integration: GET /api/appu/guest-status reports uncapped limit when called with admin Bearer token', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent'
    });

    const app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/appu/guest-status',
      headers: adminAuthHeaders
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.isUnlimited, true);
    assert.equal(body.remaining, 999999999);
    assert.equal(body.loginRequired, false);
  });

  test('integration: GET /api/subscriptions/current reflects active unlimited status for allowlisted user', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      APPU_BETA_MODE: 'false'
    });

    const mockRazorpayClient: any = {
      createSubscription: async () => ({ id: 'sub_test', status: 'created' }),
      verifySubscriptionSignature: () => true
    };

    const app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient,
      razorpayClient: mockRazorpayClient
    });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: adminAuthHeaders,
      payload: { householdName: 'CEO Household' }
    });

    const currentSubRes = await app.inject({
      method: 'GET',
      url: '/api/subscriptions/current',
      headers: adminAuthHeaders
    });

    assert.equal(currentSubRes.statusCode, 200);
    const sub = currentSubRes.json();
    assert.equal(sub.hasSubscription, true);
    assert.equal(sub.subscription.planCode, 'unlimited');
    assert.equal(sub.subscription.status, 'ACTIVE');
    assert.equal(sub.entitlements.monthly_ai_sessions, 999999999);
    assert.equal(sub.entitlements.monthly_voice_minutes, 999999999);
  });
});
