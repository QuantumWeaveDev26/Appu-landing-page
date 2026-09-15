import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
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

describe('WhatsApp Reports API (/api/appu/whatsapp/submit-feedback & send-report)', () => {
  const signingSecret = 'test_whatsapp_reports_secret_32chars_random';
  const phone = '+919876543210';
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
      parentPhone: phone,
      whatsappConsent: true
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Ananya',
      gradeBand: '10',
      status: 'ACTIVE'
    });
    childId = child.id;

    const session = await ConversationRepository.create(db, householdId, childId, 'Science Revision');
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, role, text)
       VALUES ($1, 'user', 'What is energy?'),
              ($1, 'assistant', 'Energy is the capacity to do work.')`,
      [session.id]
    );

    app = buildApp(
      {
        NODE_ENV: 'test',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'silent',
        N8N_APPU_CALLBACK_HMAC_SECRET: signingSecret,
        N8N_APPU_HMAC_MAX_AGE_SECONDS: 300
      } as any,
      {
        database: db
      }
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  function makeSignedHeaders(rawBody: string, customSecret = signingSecret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createAppuHmacSignature(rawBody, timestamp, customSecret);
    return {
      'content-type': 'application/json',
      'x-appu-timestamp': timestamp,
      'x-appu-signature': signature
    };
  }

  test('POST /api/appu/whatsapp/submit-feedback rejects unsigned request with 401', async () => {
    const payload = JSON.stringify({
      phone,
      rating: 5,
      whatsWorking: 'Great dialogues',
      whatsToImprove: 'More practice'
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/submit-feedback',
      headers: { 'content-type': 'application/json' },
      payload
    });
    assert.equal(res.statusCode, 401);
  });

  test('POST /api/appu/whatsapp/submit-feedback rejects empty whatsWorking or whatsToImprove with 400', async () => {
    const payloadEmptyWorking = JSON.stringify({
      phone,
      rating: 5,
      whatsWorking: '  ',
      whatsToImprove: 'More practice'
    });
    const resNoWorking = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/submit-feedback',
      headers: makeSignedHeaders(payloadEmptyWorking),
      payload: payloadEmptyWorking
    });
    assert.equal(resNoWorking.statusCode, 400);

    const payloadEmptyImprove = JSON.stringify({
      phone,
      rating: 5,
      whatsWorking: 'Great dialogues',
      whatsToImprove: ''
    });
    const resNoImprove = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/submit-feedback',
      headers: makeSignedHeaders(payloadEmptyImprove),
      payload: payloadEmptyImprove
    });
    assert.equal(resNoImprove.statusCode, 400);
  });

  test('POST /api/appu/whatsapp/send-report returns feedbackRequired: true before feedback', async () => {
    const payload = JSON.stringify({ phone });
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/send-report',
      headers: makeSignedHeaders(payload),
      payload
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.feedbackRequired, true);
    assert.ok(body.message.includes('feedback is required'));
  });

  test('POST /api/appu/whatsapp/submit-feedback unlocks report generation and send-report succeeds', async () => {
    // 1. Submit feedback via WhatsApp endpoint
    const feedbackPayload = JSON.stringify({
      phone,
      rating: 5,
      whatsWorking: 'Clear explanations and quick responses',
      whatsToImprove: 'Provide weekly summary'
    });

    const submitRes = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/submit-feedback',
      headers: makeSignedHeaders(feedbackPayload),
      payload: feedbackPayload
    });

    assert.equal(submitRes.statusCode, 200);
    const submitBody = JSON.parse(submitRes.body);
    assert.equal(submitBody.success, true);
    assert.equal(submitBody.reportsUnlocked, true);
    assert.equal(submitBody.feedback.rating, 5);

    // 2. Generate and send report via WhatsApp endpoint
    const sendPayload = JSON.stringify({ phone });
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/send-report',
      headers: makeSignedHeaders(sendPayload),
      payload: sendPayload
    });

    assert.equal(sendRes.statusCode, 200);
    const sendBody = JSON.parse(sendRes.body);
    assert.equal(sendBody.success, true);
    assert.equal(sendBody.feedbackRequired, false);
    assert.equal(sendBody.childName, 'Ananya');
    assert.equal(sendBody.mimeType, 'application/pdf');
    assert.equal(sendBody.documentSent, true);
    assert.ok(sendBody.filename.includes('appu-progress-report-ananya-'));
    assert.ok(typeof sendBody.pdfBase64 === 'string');
    assert.ok(sendBody.pdfBase64.length > 500);

    // Verify PDF header magic bytes '%PDF-' from base64
    const decodedPdf = Buffer.from(sendBody.pdfBase64, 'base64');
    assert.equal(decodedPdf.subarray(0, 5).toString('ascii'), '%PDF-');
  });
});
