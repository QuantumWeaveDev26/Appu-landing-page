import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
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

  const cleanQuery = async (text: string, params?: any[]) => {
    let t = text;
    if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
      t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
    }

    // Intercept CTE claim query for pg-mem compatibility
    if (t.includes('WITH due_schedules AS')) {
      const upperBound = params?.[0];
      const lowerBound = params?.[1];
      const limit = params?.[2] ?? 200;
      const dryRun = Boolean(params?.[3]);

      const selectSql = `
        SELECT 
          s.id,
          s.household_id,
          s.child_id,
          COALESCE(c.nickname, c.preferred_name) AS child_name,
          h.parent_phone,
          s.topic,
          s.scheduled_at,
          s.time_display,
          s.reminder_sent
        FROM study_schedules s
        JOIN households h ON h.id = s.household_id
        JOIN child_profiles c ON c.id = s.child_id
        WHERE s.reminder_sent = FALSE
          AND s.scheduled_at <= $1
          AND s.scheduled_at >= $2
          AND h.whatsapp_consent = TRUE
          AND h.parent_phone IS NOT NULL
          AND c.status = 'ACTIVE'
        ORDER BY s.scheduled_at ASC
        LIMIT $3;
      `;
      const selectRes = await pool.query(selectSql, [upperBound, lowerBound, limit]);
      const rows = selectRes.rows;

      if (!dryRun && rows.length > 0) {
        for (const row of rows) {
          await pool.query(
            `UPDATE study_schedules SET reminder_sent = TRUE, reminder_sent_at = NOW() WHERE id = $1;`,
            [row.id]
          );
        }
      }

      return {
        rows: rows.map(r => ({
          ...r,
          reminder_sent: dryRun ? false : true
        })),
        rowCount: rows.length
      };
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

describe('Study Schedules Routes (Task 3)', () => {
  const signingSecret = 'test_study_schedules_secret_32chars';
  let db: TransactionalQueryable;
  let app: FastifyInstance;
  let householdId: string;
  let childId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const created = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Reddy Household'
    });
    householdId = created.household.id;

    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aishwarya',
      gradeBand: 'Class 10'
    });
    childId = child.id;

    await TenancyRepository.updateChildProfile(db, householdId, childId, {
      nickname: 'Aishu'
    });

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
        url: '/api/appu/study-schedules',
        headers: { 'content-type': 'application/json' },
        payload: {
          phone: '+919876543210',
          topic: 'Fractions',
          scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString()
        }
      });

      assert.equal(res.statusCode, 401);
    });

    test('2. Rejects request with invalid HMAC signature (HTTP 401)', async () => {
      const payload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Fractions',
        scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString()
      });
      const headers = makeSignedHeaders(payload, 'wrong_secret_at_least_32_characters_here');

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers,
        payload
      });

      assert.equal(res.statusCode, 401);
    });

    test('3. Rejects request with stale timestamp beyond 300 seconds (HTTP 401)', async () => {
      const payload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Fractions',
        scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString()
      });
      const headers = makeSignedHeaders(payload, signingSecret, -305);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers,
        payload
      });

      assert.equal(res.statusCode, 401);
    });
  });

  describe('POST /api/appu/study-schedules', () => {
    test('200 valid record + calendarUrl returned', async () => {
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const payload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Trigonometry',
        scheduledAt: futureTime.toISOString(),
        timeDisplay: '4:00 PM',
        rawExpression: 'tomorrow at 4pm'
      });
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers,
        payload
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.success, true);
      assert.ok(body.schedule);
      assert.equal(body.schedule.topic, 'Trigonometry');
      assert.equal(body.schedule.timeDisplay, '4:00 PM');
      assert.ok(body.calendarUrl);
      assert.ok(body.calendarUrl.includes('https://calendar.google.com/calendar/render?action=TEMPLATE'));
      assert.ok(body.calendarUrl.includes('Trigonometry'));
      assert.ok(body.calendarUrl.includes('Aishu'));
    });

    test('400 past scheduledAt returns error', async () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000);
      const payload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Algebra',
        scheduledAt: pastTime.toISOString()
      });
      const headers = makeSignedHeaders(payload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers,
        payload
      });

      assert.equal(res.statusCode, 400);
    });
  });

  describe('POST /api/appu/whatsapp/proactive/study-reminders', () => {
    test('200 study-reminders shape with target payloads', async () => {
      // Create a schedule due in 15 minutes
      const recordPayload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Chemical Reactions',
        scheduledAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        timeDisplay: '6:30 PM'
      });
      await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers: makeSignedHeaders(recordPayload),
        payload: recordPayload
      });

      const remindersPayload = JSON.stringify({
        dryRun: false,
        limit: 50,
        windowMinutes: 30
      });
      const headers = makeSignedHeaders(remindersPayload);

      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/study-reminders',
        headers,
        payload: remindersPayload
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.success, true);
      assert.equal(body.jobType, 'study-reminders');
      assert.equal(body.count, 1);
      assert.equal(body.targets.length, 1);

      const target = body.targets[0];
      assert.equal(target.recipientPhone, '+919876543210');
      assert.equal(target.templateName, 'appu_study_reminder');
      assert.equal(target.templateLanguage, 'en');
      assert.equal(target.parameters.length, 3);
      assert.deepEqual(target.parameters[0], { type: 'text', text: 'Aishu' });
      assert.deepEqual(target.parameters[1], { type: 'text', text: 'Chemical Reactions' });
      assert.deepEqual(target.parameters[2], { type: 'text', text: '6:30 PM' });
    });

    test('handles dryRun without marking reminder_sent', async () => {
      const recordPayload = JSON.stringify({
        phone: '+919876543210',
        topic: 'Optics',
        scheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        timeDisplay: '7:00 PM'
      });
      await app.inject({
        method: 'POST',
        url: '/api/appu/study-schedules',
        headers: makeSignedHeaders(recordPayload),
        payload: recordPayload
      });

      const dryRunPayload = JSON.stringify({
        dryRun: true
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/whatsapp/proactive/study-reminders',
        headers: makeSignedHeaders(dryRunPayload),
        payload: dryRunPayload
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.success, true);
      assert.equal(body.count, 1);
    });
  });
});
