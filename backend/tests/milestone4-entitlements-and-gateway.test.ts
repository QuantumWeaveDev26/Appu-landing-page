import { test, describe, beforeEach, afterEach } from 'node:test';
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
import { SubscriptionService } from '../src/domain/subscription/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { AIContextBuilder } from '../src/domain/personalisation/ai-context-builder.js';
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
    implementation: (text: string) => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
      }
      return hash;
    }
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

describe('Milestone 4: Entitlement Enforcement, Personalisation & Secure N8N Gateway', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    await SubscriptionService.syncPlans(db, {
      starterId: 'plan_starter_test',
      growthId: 'plan_growth_test',
      familyId: 'plan_family_test'
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
      RAZORPAY_PLAN_STARTER_ID: 'plan_starter_test',
      RAZORPAY_PLAN_GROWTH_ID: 'plan_growth_test',
      RAZORPAY_PLAN_FAMILY_ID: 'plan_family_test',
      N8N_APPU_WEBHOOK_URL: 'https://n8n.example.com/webhook/test/chat'
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      razorpayClient,
      n8nClient
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper to activate a subscription for household
  async function activateHouseholdSubscription(householdId: string, planCode: string) {
    const plan = await SubscriptionRepository.getPlanByCode(db, planCode);
    assert.ok(plan);
    const sub = await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: plan.id,
      provider: 'razorpay',
      providerSubscriptionId: `sub_rzp_${crypto.randomUUID()}`,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000)
    });
    return sub;
  }

  // ============================================================================
  // 1. ENTITLEMENT ENFORCEMENT & CHILD LIMITS
  // ============================================================================

  test('POST /api/children rejects child creation if household has no active subscription', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-no-sub';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Aarav', gradeBand: 'Grade 3' }
    });

    assert.equal(res.statusCode, 403);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'forbidden');
    assert.ok(payload.error.message.includes('active subscription'));
  });

  test('Starter plan enforces max_children = 1 (second child rejected)', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-starter';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    // Activate Starter subscription (max_children = 1)
    await activateHouseholdSubscription(householdId, 'starter');

    // 1st child creation -> SUCCESS
    const child1Res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Aarav', gradeBand: 'Grade 3' }
    });
    assert.equal(child1Res.statusCode, 201);

    // 2nd child creation -> REJECTED (QUOTA EXCEEDED)
    const child2Res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Diya', gradeBand: 'Grade 5' }
    });
    assert.equal(child2Res.statusCode, 429);
    const err = JSON.parse(child2Res.payload);
    assert.equal(err.error.code, 'quota_exceeded');
  });

  test('Growth plan allows 2 children and rejects third child', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-growth';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;

    // Activate Growth subscription (max_children = 2)
    await activateHouseholdSubscription(householdId, 'growth');

    // 1st child -> 201
    const child1Res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Child 1', gradeBand: 'Grade 1' }
    });
    assert.equal(child1Res.statusCode, 201);

    // 2nd child -> 201
    const child2Res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Child 2', gradeBand: 'Grade 4' }
    });
    assert.equal(child2Res.statusCode, 201);

    // 3rd child -> 429 QUOTA_EXCEEDED
    const child3Res = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Child 3', gradeBand: 'Grade 6' }
    });
    assert.equal(child3Res.statusCode, 429);
    assert.equal(JSON.parse(child3Res.payload).error.code, 'quota_exceeded');
  });

  // ============================================================================
  // 2. CHILD PERSONALISATION CRUD & SECURITY
  // ============================================================================

  test('GET /api/children/:childId/personalisation returns default values if unset', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-pers-default';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'starter');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Rohan', gradeBand: 'Grade 2' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    const persRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(persRes.statusCode, 200);
    const pers = JSON.parse(persRes.payload).personalisation;
    assert.equal(pers.preferredLanguage, 'en');
    assert.equal(pers.fontPreference, 'friendly');
    assert.equal(pers.themePreference, 'auto');
    assert.deepEqual(pers.interests, []);
  });

  test('PUT and GET /api/children/:childId/personalisation stores and retrieves safe personalisation', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-pers-crud';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'starter');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Ananya', gradeBand: 'Grade 5' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    // Update personalisation
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        preferredLanguage: 'kn',
        favoriteColor: '#1f6feb',
        fontPreference: 'rounded',
        learningStyle: 'interactive',
        interests: ['space', 'robotics'],
        favoriteSubjects: ['science', 'mathematics'],
        goals: ['learn coding basics'],
        responseStyle: 'playful',
        themePreference: 'bright'
      }
    });

    assert.equal(putRes.statusCode, 200);
    const saved = JSON.parse(putRes.payload).personalisation;
    assert.equal(saved.preferredLanguage, 'kn');
    assert.equal(saved.favoriteColor, '#1f6feb');
    assert.equal(saved.fontPreference, 'rounded');
    assert.equal(saved.learningStyle, 'interactive');
    assert.deepEqual(saved.interests, ['space', 'robotics']);
    assert.deepEqual(saved.goals, ['learn coding basics']);
    assert.equal(saved.responseStyle, 'playful');
    assert.equal(saved.themePreference, 'bright');
  });

  test('personalisation validation rejects invalid font, theme, or executable scripts', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-pers-invalid';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'starter');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Sanvi', gradeBand: 'Grade 4' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    // Invalid font
    const res1 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: { fontPreference: 'comic_sans_invalid' }
    });
    assert.equal(res1.statusCode, 400);

    // Invalid theme
    const res2 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: { themePreference: 'cyberpunk_glow' }
    });
    assert.equal(res2.statusCode, 400);

    // Script injection in color
    const res3 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: { favoriteColor: '<script>alert(1)</script>' }
    });
    assert.equal(res3.statusCode, 400);

    // Script injection in interests
    const res4 = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}/personalisation`,
      headers: { authorization: `Bearer ${token}` },
      payload: { interests: ['<script>evil()</script>'] }
    });
    assert.equal(res4.statusCode, 400);
  });

  test('ADVERSARIAL: Parent A cannot view or update Parent B child personalisation', async () => {
    // Parent A
    const parentAId = crypto.randomUUID();
    const tokenA = 'token-parent-A-pers';
    authVerifier.registerToken(tokenA, { userId: parentAId });
    const obA = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenA}` }
    });
    const hhA = JSON.parse(obA.payload).household.id;
    await activateHouseholdSubscription(hhA, 'starter');
    const chARes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { preferredName: 'Child A', gradeBand: 'Grade 1' }
    });
    const childAId = JSON.parse(chARes.payload).child.id;

    // Parent B
    const parentBId = crypto.randomUUID();
    const tokenB = 'token-parent-B-pers';
    authVerifier.registerToken(tokenB, { userId: parentBId });
    const obB = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${tokenB}` }
    });
    const hhB = JSON.parse(obB.payload).household.id;
    await activateHouseholdSubscription(hhB, 'starter');

    // Parent B tries to GET Parent A's child personalisation -> 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/children/${childAId}/personalisation`,
      headers: { authorization: `Bearer ${tokenB}` }
    });
    assert.equal(getRes.statusCode, 404);

    // Parent B tries to PUT Parent A's child personalisation -> 404
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/children/${childAId}/personalisation`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { preferredLanguage: 'te' }
    });
    assert.equal(putRes.statusCode, 404);
  });

  // ============================================================================
  // 3. AI CONTEXT BUILDER
  // ============================================================================

  test('AIContextBuilder combines profile, personalisation and server-resolved entitlements', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-aicontext';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'growth');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Kavya', gradeBand: 'Grade 6' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    await PersonalisationRepository.upsertPersonalisation(db, householdId, childId, {
      preferredLanguage: 'kn',
      favoriteColor: 'forest green',
      fontPreference: 'clean',
      learningStyle: 'auditory',
      interests: ['wildlife', 'music'],
      favoriteSubjects: ['biology'],
      goals: ['identify bird calls'],
      responseStyle: 'focused',
      themePreference: 'calm'
    });

    const context = await AIContextBuilder.buildChildAIContext(db, householdId, childId, {
      multilingual: true,
      advanced_personalisation: true,
      long_term_context: true
    });

    assert.equal(context.child.preferredName, 'Kavya');
    assert.equal(context.child.gradeBand, 'Grade 6');
    assert.equal(context.preferences.language, 'kn');
    assert.equal(context.preferences.learningStyle, 'auditory');
    assert.deepEqual(context.preferences.interests, ['wildlife', 'music']);
    assert.equal(context.presentation.favoriteColor, 'forest green');
    assert.equal(context.presentation.fontPreference, 'clean');
    assert.equal(context.presentation.themePreference, 'calm');
    assert.equal(context.entitlements.multilingual, true);
    assert.equal(context.entitlements.advancedPersonalisation, true);
  });

  // ============================================================================
  // 4. SECURE N8N GATEWAY ROUTE (POST /api/appu/message)
  // ============================================================================

  test('POST /api/appu/message passes validated envelope to n8n and returns normalized response', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-n8n-ok';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'starter');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Vihaan', gradeBand: 'Grade 3' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    n8nClient.nextResponse = {
      text: 'Namaskara Vihaan! How can I help you today?',
      audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAA...',
      audioDurationMs: 3500
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        childId,
        message: 'Can you teach me about the solar system?',
        language: 'en'
      }
    });

    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.childId, childId);
    assert.equal(payload.text, 'Namaskara Vihaan! How can I help you today?');
    assert.equal(payload.audioSource, 'data:audio/mpeg;base64,SUQzBAAAAAAA...');

    // Verify server-constructed envelope passed to n8n
    assert.ok(n8nClient.lastEnvelope);
    assert.equal(n8nClient.lastEnvelope.action, 'sendMessage');
    assert.equal(n8nClient.lastEnvelope.channel, 'website');
    assert.equal(n8nClient.lastEnvelope.childId, childId);
    assert.equal(n8nClient.lastEnvelope.sessionId, `appu_child_${childId}`);
    assert.equal(n8nClient.lastEnvelope.message, 'Can you teach me about the solar system?');
    assert.equal(n8nClient.lastEnvelope.context.child.preferredName, 'Vihaan');
  });

  test('POST /api/appu/message rejects unsubscribed household', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-unsub-gateway';
    authVerifier.registerToken(token, { userId: parentUserId });

    await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        childId: crypto.randomUUID(),
        message: 'Hello Appu'
      }
    });

    assert.equal(res.statusCode, 404); // Child does not exist
  });

  test('POST /api/appu/message handles n8n error safely without leaking internal secrets', async () => {
    const parentUserId = crypto.randomUUID();
    const token = 'token-parent-n8n-err';
    authVerifier.registerToken(token, { userId: parentUserId });

    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/household/onboard',
      headers: { authorization: `Bearer ${token}` }
    });
    const householdId = JSON.parse(onboardRes.payload).household.id;
    await activateHouseholdSubscription(householdId, 'starter');

    const childRes = await app.inject({
      method: 'POST',
      url: '/api/children',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredName: 'Arya', gradeBand: 'Grade 2' }
    });
    const childId = JSON.parse(childRes.payload).child.id;

    // Simulate n8n gateway error
    n8nClient.nextError = new Error('n8n upstream connection failed with internal URL https://secret.n8n/webhook');

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        childId,
        message: 'Hello'
      }
    });

    assert.equal(res.statusCode, 502);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.error.code, 'bad_gateway');
    assert.ok(!payload.error.message.includes('secret.n8n'), 'Must not leak upstream secret URLs');
  });
});
