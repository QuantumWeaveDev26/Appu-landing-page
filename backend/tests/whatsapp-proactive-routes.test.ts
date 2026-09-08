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
import { DEFAULT_TEMPLATE_LANGUAGE } from '../src/domain/whatsapp/proactive/types.js';
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

describe('Proactive WhatsApp Routes (Task 3)', () => {
  const signingSecret = 'test_proactive_signing_secret_32chars';
  let db: TransactionalQueryable;
  let app: FastifyInstance;
  let householdId: string;
  let childId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Sharma Household'
    });
    householdId = created.household.id;

    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // Compute today in Asia/Kolkata for birthday test setup
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const mm = parts.find((p) => p.type === 'month')!.value;
    const dd = parts.find((p) => p.type === 'day')!.value;
    const todayKolkataDob = `2014-${mm}-${dd}`;

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aarav',
      gradeBand: 'Grade 7'
    });
    childId = child.id;

    await TenancyRepository.updateChildProfile(db, householdId, childId, {
      nickname: 'Aaru',
      dob: todayKolkataDob
    });

    await PersonalisationRepository.upsertPersonalisation(db, householdId, childId, {
      favoriteSubjects: ['Mathematics', 'Science']
    });

    const session = await ConversationRepository.create(db, householdId, childId, 'Fractions Review');
    await db.query(`INSERT INTO conversation_messages (conversation_id, role, text) VALUES ($1, $2, $3)`, [
      session.id,
      'user',
      'How to add fractions?'
    ]);

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

  function makeSignedHeaders(rawBody: string, customSecret = signingSecret, timestampOffsetSeconds = 0) {
    const timestamp = String(Math.floor(Date.now() / 1000) + timestampOffsetSeconds);
    const signature = createAppuHmacSignature(rawBody, timestamp, customSecret);
    return {
      'content-type': 'application/json',
      'x-appu-timestamp': timestamp,
      'x-appu-signature': signature
    };
  }

  describe('HMAC Authentication Guard', () => {
    test('1. Rejects request missing HMAC signature or timestamp (HTTP 401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/weekly-digest',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({})
      });

      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.body);
      assert.ok(body.error || body.message);
    });

    test('2. Rejects request with invalid HMAC signature (HTTP 401)', async () => {
      const payload = JSON.stringify({ dryRun: true });
      const headers = makeSignedHeaders(payload, 'wrong_secret_key_that_does_not_match');

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/daily-tip',
        headers,
        payload
      });

      assert.equal(res.statusCode, 401);
    });

    test('3. Rejects request with stale timestamp (> 300s in past) (HTTP 401)', async () => {
      const payload = JSON.stringify({});
      const headers = makeSignedHeaders(payload, signingSecret, -360);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/birthday-wishes',
        headers,
        payload
      });

      assert.equal(res.statusCode, 401);
    });
  });

  describe('Endpoints Functionality & Payload Contracts', () => {
    test('4. POST /weekly-digest returns 200 with ProactiveJobResponse and 3 template parameters', async () => {
      const payload = JSON.stringify({ dryRun: false, limit: 10 });
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/weekly-digest',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.jobType, 'weekly-digest');
      assert.equal(data.count, 1);
      assert.equal(data.targets.length, 1);

      const target = data.targets[0];
      assert.equal(target.householdId, householdId);
      assert.equal(target.childId, childId);
      assert.equal(target.recipientPhone, '+919876543210');
      assert.equal(target.templateName, 'appu_weekly_digest');
      assert.equal(target.templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(target.parameters.length, 3);
      assert.equal(target.parameters[0].text, 'Aaru');
      assert.ok(target.parameters[1].text.includes('Fractions Review'));
    });

    test('5. POST /daily-tip returns 200 with ProactiveJobResponse and 2 template parameters', async () => {
      const payload = JSON.stringify({});
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/daily-tip',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.jobType, 'daily-tip');
      assert.equal(data.count, 1);
      assert.equal(data.targets.length, 1);

      const target = data.targets[0];
      assert.equal(target.templateName, 'appu_daily_tip');
      assert.equal(target.templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(target.parameters.length, 2);
      assert.equal(target.parameters[0].text, 'Aaru');
      assert.ok(target.parameters[1].text.length > 10);
    });

    test('6. POST /birthday-wishes returns 200 with ProactiveJobResponse and 1 template parameter', async () => {
      const payload = JSON.stringify({});
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/birthday-wishes',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.jobType, 'birthday-wishes');
      assert.equal(data.count, 1);
      assert.equal(data.targets.length, 1);

      const target = data.targets[0];
      assert.equal(target.templateName, 'appu_birthday_wish');
      assert.equal(target.templateLanguage, DEFAULT_TEMPLATE_LANGUAGE);
      assert.equal(target.parameters.length, 1);
      assert.equal(target.parameters[0].text, 'Aaru');
    });

    test('7. Handles dryRun and custom limit cleanly', async () => {
      const payload = JSON.stringify({ dryRun: true, limit: 1 });
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/daily-tip',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const data = JSON.parse(res.body);
      assert.equal(data.success, true);
      assert.equal(data.count, 1);
    });
  });
});
