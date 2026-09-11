import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { runMigrations } from '../src/db/migrator.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { WhatsAppOnboardingRepository } from '../src/domain/whatsapp/onboarding/repository.js';
import { WhatsAppOnboardingService } from '../src/domain/whatsapp/onboarding/service.js';
import { REQUIRED_ONBOARDING_FIELDS } from '../src/domain/whatsapp/onboarding/types.js';
import { buildApp } from '../src/app.js';
import { createAppuHmacSignature } from '../src/domain/gateway/hmac.js';
import type { FastifyInstance } from 'fastify';

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

describe('WhatsApp Conversational Onboarding Backend', () => {
  const signingSecret = 'test_whatsapp_onboarding_secret_32ch';
  let db: TransactionalQueryable;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    app = buildApp(
      {
        NODE_ENV: 'test',
        PORT: 0,
        DATABASE_URL: 'memory://test',
        APP_ENV: 'test',
        N8N_APPU_CALLBACK_HMAC_SECRET: signingSecret,
        N8N_APPU_HMAC_MAX_AGE_SECONDS: 300,
        APPU_BETA_MODE: true,
        APPU_BETA_CHAT_LIMIT: 30
      } as any,
      {
        database: db,
        authVerifier: {
          verifyAccessToken: async (token: string) => {
            return { userId: token, email: `${token}@example.com` };
          }
        }
      }
    );

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function makeSignedHeaders(payload: unknown, customSecret = signingSecret, timestampOffsetSeconds = 0) {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000) + timestampOffsetSeconds);
    const signature = createAppuHmacSignature(rawBody, timestamp, customSecret);
    return {
      'content-type': 'application/json',
      'x-appu-timestamp': timestamp,
      'x-appu-signature': signature
    };
  }

  describe('POST /api/appu/whatsapp/onboarding/state', () => {
    test('rejects unsigned request with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/state',
        payload: { phone: '+919876543210' }
      });
      assert.equal(res.statusCode, 401);
    });

    test('rejects invalid signature with 401 Unauthorized', async () => {
      const payload = { phone: '+919876543210' };
      const headers = makeSignedHeaders(payload, 'wrong_secret_123456789012345678');
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/state',
        headers,
        payload
      });
      assert.equal(res.statusCode, 401);
    });

    test('returns unrecognized state for unknown phone number', async () => {
      const payload = { phone: '+919876543210' };
      const headers = makeSignedHeaders(payload);
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/state',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const data = res.json();
      assert.equal(data.recognized, false);
      assert.equal(data.complete, false);
      assert.deepEqual(data.missingFields, REQUIRED_ONBOARDING_FIELDS);
      assert.equal(data.nextPromptField, 'name');
      assert.equal(data.householdId, null);
      assert.equal(data.childId, null);
      assert.equal(data.personalisation, null);
    });

    test('normalizes raw Indian phone numbers (10 digits or 91 prefix)', async () => {
      const payload = { phone: '9876543210' };
      const headers = makeSignedHeaders(payload);
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/state',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.json().recognized, false);
    });
  });

  describe('POST /api/appu/whatsapp/onboarding/save-step', () => {
    test('rejects unsigned request with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        payload: { phone: '+919876543210', field: 'name', value: 'Aarav' }
      });
      assert.equal(res.statusCode, 401);
    });

    test('rejects invalid field inputs with 400 Bad Request', async () => {
      // Forbidden characters in name
      const payload1 = { phone: '+919876543210', field: 'name', value: '<script>alert(1)</script>' };
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(payload1),
        payload: payload1
      });
      assert.equal(res1.statusCode, 400);

      // Invalid DOB (age too young)
      const payload2 = { phone: '+919876543210', field: 'dob', value: '2026-01-01' };
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(payload2),
        payload: payload2
      });
      assert.equal(res2.statusCode, 400);

      // Invalid learning style enum
      const payload3 = { phone: '+919876543210', field: 'learningStyle', value: 'telepathic' };
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(payload3),
        payload: payload3
      });
      assert.equal(res3.statusCode, 400);
    });

    test('incremental step-by-step onboarding flow', async () => {
      const phone = '+919876543210';

      // Step 1: Save name
      const step1Payload = { phone, field: 'name', value: 'Aarav' };
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step1Payload),
        payload: step1Payload
      });
      assert.equal(res1.statusCode, 200);
      const data1 = res1.json();
      assert.equal(data1.success, true);
      assert.equal(data1.recognized, true);
      assert.equal(data1.complete, false);
      assert.equal(data1.personalisation.name, 'Aarav');
      assert.ok(data1.householdId);
      assert.ok(data1.childId);
      assert.equal(data1.nextPromptField, 'grade');

      // Step 2: Save grade
      const step2Payload = { phone, field: 'grade', value: 'Grade 8' };
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step2Payload),
        payload: step2Payload
      });
      assert.equal(res2.statusCode, 200);
      const data2 = res2.json();
      assert.equal(data2.personalisation.name, 'Aarav');
      assert.equal(data2.personalisation.grade, 'Grade 8');
      assert.equal(data2.nextPromptField, 'dob');

      // Step 3: Save DOB (valid 12-year-old)
      const step3Payload = { phone, field: 'dob', value: '2014-05-15' };
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step3Payload),
        payload: step3Payload
      });
      assert.equal(res3.statusCode, 200);
      const data3 = res3.json();
      assert.equal(data3.personalisation.dob, '2014-05-15');
      assert.equal(data3.nextPromptField, 'preferredLanguage');

      // Step 4: Save preferred language
      const step4Payload = { phone, field: 'preferredLanguage', value: 'en' };
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step4Payload),
        payload: step4Payload
      });
      assert.equal(res4.statusCode, 200);
      const data4 = res4.json();
      assert.equal(data4.personalisation.preferredLanguage, 'en');
      assert.equal(data4.nextPromptField, 'favoriteSubjects');

      // Step 5: Save favorite subjects (comma-separated string normalized)
      const step5Payload = { phone, field: 'favoriteSubjects', value: 'Mathematics, Science' };
      const res5 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step5Payload),
        payload: step5Payload
      });
      assert.equal(res5.statusCode, 200);
      const data5 = res5.json();
      assert.deepEqual(data5.personalisation.favoriteSubjects, ['Mathematics', 'Science']);
      assert.equal(data5.nextPromptField, 'interests');

      // Step 6: Save interests (array)
      const step6Payload = { phone, field: 'interests', value: ['Robotics', 'Space'] };
      const res6 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step6Payload),
        payload: step6Payload
      });
      assert.equal(res6.statusCode, 200);
      const data6 = res6.json();
      assert.deepEqual(data6.personalisation.interests, ['Robotics', 'Space']);
      assert.equal(data6.nextPromptField, 'learningStyle');

      // Step 7: Save learning style
      const step7Payload = { phone, field: 'learningStyle', value: 'visual' };
      const res7 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step7Payload),
        payload: step7Payload
      });
      assert.equal(res7.statusCode, 200);
      const data7 = res7.json();
      assert.equal(data7.personalisation.learningStyle, 'visual');
      assert.equal(data7.nextPromptField, 'responseStyle');

      // Step 8: Save response style
      const step8Payload = { phone, field: 'responseStyle', value: 'playful' };
      const res8 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step8Payload),
        payload: step8Payload
      });
      assert.equal(res8.statusCode, 200);
      const data8 = res8.json();
      assert.equal(data8.personalisation.responseStyle, 'playful');
      assert.equal(data8.nextPromptField, 'goals');

      // Step 9: Save goals
      const step9Payload = { phone, field: 'goals', value: ['Ace Math Olympiad'] };
      const res9 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step9Payload),
        payload: step9Payload
      });
      assert.equal(res9.statusCode, 200);
      const data9 = res9.json();
      assert.deepEqual(data9.personalisation.goals, ['Ace Math Olympiad']);
      assert.equal(data9.nextPromptField, 'whatsappConsent');
      assert.equal(data9.complete, false);

      // Step 10: Explicit WhatsApp consent affirmative
      const step10Payload = { phone, field: 'whatsappConsent', value: true };
      const res10 = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(step10Payload),
        payload: step10Payload
      });
      assert.equal(res10.statusCode, 200);
      const data10 = res10.json();
      assert.equal(data10.personalisation.whatsappConsent, true);
      assert.equal(data10.complete, true);
      assert.deepEqual(data10.missingFields, []);
      assert.equal(data10.nextPromptField, null);

      // Verify GET /state now reflects complete profile
      const stateRes = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/state',
        headers: makeSignedHeaders({ phone }),
        payload: { phone }
      });
      assert.equal(stateRes.statusCode, 200);
      const stateData = stateRes.json();
      assert.equal(stateData.recognized, true);
      assert.equal(stateData.complete, true);
      assert.deepEqual(stateData.missingFields, []);
      assert.equal(stateData.personalisation.name, 'Aarav');
      assert.equal(stateData.personalisation.grade, 'Grade 8');
    });

    test('batch multi-field saving in a single request', async () => {
      const phone = '+919988776655';
      const batchPayload = {
        phone,
        fields: {
          name: 'Priya',
          grade: 'Grade 10',
          dob: '2010-08-20',
          preferredLanguage: 'hi',
          favoriteSubjects: ['Physics', 'Chemistry'],
          interests: ['Astronomy'],
          learningStyle: 'interactive',
          responseStyle: 'focused',
          goals: ['Prepare for JEE'],
          whatsappConsent: true
        }
      };

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/onboarding/save-step',
        headers: makeSignedHeaders(batchPayload),
        payload: batchPayload
      });

      assert.equal(res.statusCode, 200);
      const data = res.json();
      assert.equal(data.success, true);
      assert.equal(data.recognized, true);
      assert.equal(data.complete, true);
      assert.equal(data.personalisation.name, 'Priya');
      assert.equal(data.personalisation.grade, 'Grade 10');
      assert.equal(data.personalisation.preferredLanguage, 'hi');
      assert.deepEqual(data.missingFields, []);
    });
  });
});
