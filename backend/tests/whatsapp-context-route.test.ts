import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { PersonalisationRepository } from '../src/domain/personalisation/repository.js';
import { ConversationRepository } from '../src/domain/conversation/index.js';
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

describe('POST /api/appu/whatsapp/context (Task 3)', () => {
  const signingSecret = 'test_whatsapp_context_signing_secret_32chars';
  let db: TransactionalQueryable;
  let app: FastifyInstance;
  let householdId: string;
  let childId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Kulkarni Household'
    });
    householdId = created.household.id;

    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Ananya',
      gradeBand: 'Class 10',
      status: 'ACTIVE'
    });
    childId = child.id;

    await PersonalisationRepository.upsertPersonalisation(db, householdId, childId, {
      preferredLanguage: 'hi',
      learningStyle: 'auditory',
      responseStyle: 'playful',
      favoriteSubjects: ['Biology'],
      interests: ['Gardening'],
      goals: ['Board exams']
    });

    const session = await ConversationRepository.create(db, householdId, childId, 'Botany Revision');
    await db.query(
      `INSERT INTO conversation_messages (id, conversation_id, request_id, role, text, has_image_attachment, created_at)
       VALUES (gen_random_uuid(), $1, NULL, 'user', 'What is photosynthesis?', FALSE, NOW()),
              (gen_random_uuid(), $1, NULL, 'assistant', 'Photosynthesis is how green plants make food using sunlight.', FALSE, NOW())`,
      [session.id]
    );

    app = buildApp({
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '0.0.0.0',
      LOG_LEVEL: 'silent',
      N8N_APPU_CALLBACK_HMAC_SECRET: signingSecret,
      N8N_APPU_HMAC_MAX_AGE_SECONDS: 300
    } as any, {
      database: db
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  function makeSignedHeaders(rawBody: string, customSecret = signingSecret, timestampOffsetSeconds = 0) {
    const timestamp = String(Math.floor(Date.now() / 1000) + timestampOffsetSeconds);
    const signature = createAppuHmacSignature(rawBody, timestamp, customSecret);
    return {
      'content-type': 'application/json',
      'x-appu-timestamp': timestamp,
      'x-appu-signature': signature
    };
  }

  test('1. Rejects request with missing signature or timestamp headers (HTTP 401)', async () => {
    const payload = JSON.stringify({ phone: '+919876543210' });

    // Missing both
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers: { 'content-type': 'application/json' },
      payload
    });
    assert.equal(res1.statusCode, 401);

    // Missing timestamp only
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers: {
        'content-type': 'application/json',
        'x-appu-signature': 'v1=abcd'
      },
      payload
    });
    assert.equal(res2.statusCode, 401);

    // Missing signature only
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers: {
        'content-type': 'application/json',
        'x-appu-timestamp': String(Math.floor(Date.now() / 1000))
      },
      payload
    });
    assert.equal(res3.statusCode, 401);
  });

  test('2. Rejects request with invalid or tampered HMAC signature (HTTP 401)', async () => {
    const payload = JSON.stringify({ phone: '+919876543210' });
    const headers = makeSignedHeaders(payload, 'wrong_secret_at_least_32_chars_long');

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers,
      payload
    });

    assert.equal(res.statusCode, 401);
  });

  test('3. Rejects request with stale timestamp beyond 300 seconds (HTTP 401)', async () => {
    const payload = JSON.stringify({ phone: '+919876543210' });
    // Timestamp 350 seconds in the past
    const headers = makeSignedHeaders(payload, signingSecret, -350);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers,
      payload
    });

    assert.equal(res.statusCode, 401);
  });

  test('4. Rejects request with missing or empty phone payload (HTTP 400)', async () => {
    const payload = JSON.stringify({ phone: '' });
    const headers = makeSignedHeaders(payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers,
      payload
    });

    assert.equal(res.statusCode, 400);
  });

  test('5. Valid signed request with recognized phone returns 200 with full context', async () => {
    const payload = JSON.stringify({ phone: '9876543210', turnLimit: 8 });
    const headers = makeSignedHeaders(payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers,
      payload
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.recognized, true);
    assert.equal(body.householdId, householdId);
    assert.equal(body.childId, childId);
    assert.equal(body.mentorContext.learnerName, 'Ananya');
    assert.equal(body.mentorContext.grade, 'Class 10');
    assert.equal(body.mentorContext.primaryLanguage, 'en');
    assert.equal(body.conversationHistory.length, 2);
    assert.match(body.formattedTranscript, /Prior conversation transcript/);
    assert.match(body.formattedTranscript, /What is photosynthesis\?/);
  });

  test('6. Valid signed request with unrecognized phone returns 200 with recognized=false & linkNudge', async () => {
    const payload = JSON.stringify({ phone: '+919999999999' });
    const headers = makeSignedHeaders(payload);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/context',
      headers,
      payload
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.recognized, false);
    assert.ok(typeof body.linkNudge === 'string');
  });

  test('7. Fail-safe invariant: service/database error returns 200 with recognized=false, never 500', async () => {
    const brokenDb: TransactionalQueryable = {
      async query() {
        throw new Error('Postgres connection pool exhausted');
      },
      async transaction() {
        throw new Error('Postgres connection pool exhausted');
      }
    };

    const brokenApp = buildApp({
      NODE_ENV: 'test',
      PORT: 3000,
      HOST: '0.0.0.0',
      LOG_LEVEL: 'silent',
      N8N_APPU_CALLBACK_HMAC_SECRET: signingSecret,
      N8N_APPU_HMAC_MAX_AGE_SECONDS: 300
    } as any, {
      database: brokenDb
    });

    try {
      const payload = JSON.stringify({ phone: '+919876543210' });
      const headers = makeSignedHeaders(payload);

      const res = await brokenApp.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/context',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.json().recognized, false);
    } finally {
      await brokenApp.close();
    }
  });
});
