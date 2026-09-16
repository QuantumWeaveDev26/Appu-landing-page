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

describe('Child Session Alerts Route: POST /api/appu/whatsapp/proactive/child-session-alert', () => {
  const signingSecret = 'test_child_session_alert_secret_32chars';
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

    const child = await TenancyRepository.createChildProfile(db, {
      householdId,
      preferredName: 'Aarav',
      gradeBand: 'MIDDLE'
    });
    childId = child.id;

    // Set nickname
    await db.query(
      `UPDATE child_profiles SET nickname = 'Chintu' WHERE id = $1;`,
      [childId]
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

  function makeAuthHeaders(body: object, timestampOffsetSeconds = 0) {
    const rawBody = JSON.stringify(body);
    const timestamp = (Math.floor(Date.now() / 1000) + timestampOffsetSeconds).toString();
    const signature = createAppuHmacSignature(rawBody, timestamp, signingSecret);
    return {
      'content-type': 'application/json',
      'x-appu-timestamp': timestamp,
      'x-appu-signature': signature
    };
  }

  test('1. Rejects request without HMAC auth (HTTP 401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      payload: { dryRun: false }
    });
    assert.equal(res.statusCode, 401);
  });

  test('2. Emits START alert for session started 5 minutes ago and records start_sent_at', async () => {
    const sessionId = crypto.randomUUID();
    const startedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago

    await db.query(
      `INSERT INTO conversation_sessions (id, household_id, child_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, 'Fractions practice', $4, $4);`,
      [sessionId, householdId, childId, startedAt]
    );

    const body = { dryRun: false };
    const headers = makeAuthHeaders(body);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers,
      payload: body
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.success, true);
    assert.equal(data.jobType, 'child-session-alert');
    assert.equal(data.count, 1);
    assert.equal(data.targets.length, 1);

    const target = data.targets[0];
    assert.equal(target.alertType, 'start');
    assert.equal(target.sessionId, sessionId);
    assert.equal(target.recipientPhone, '919876543210');
    assert.equal(target.templateName, 'appu_child_session_start');
    assert.equal(target.templateLanguage, 'en');
    assert.deepEqual(target.parameters, [
      { type: 'text', text: 'Sharma Household' },
      { type: 'text', text: 'Chintu' }
    ]);

    // Verify session_alerts table has recorded start_sent_at
    const alertRow = await db.query(
      `SELECT session_id, start_sent_at, thirty_sent_at FROM session_alerts WHERE session_id = $1;`,
      [sessionId]
    );
    assert.equal(alertRow.rows.length, 1);
    assert.ok(alertRow.rows[0].start_sent_at);
    assert.equal(alertRow.rows[0].thirty_sent_at, null);

    // Second call immediately returns 0 targets due to strict dedup
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers: makeAuthHeaders(body),
      payload: body
    });
    const data2 = res2.json();
    assert.equal(data2.success, true);
    assert.equal(data2.count, 0);
    assert.equal(data2.targets.length, 0);
  });

  test('3. Emits THIRTY alert for session started 35 minutes ago and records thirty_sent_at', async () => {
    const sessionId = crypto.randomUUID();
    const startedAt = new Date(Date.now() - 35 * 60 * 1000); // 35 min ago

    await db.query(
      `INSERT INTO conversation_sessions (id, household_id, child_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, 'Algebra study', $4, $4);`,
      [sessionId, householdId, childId, startedAt]
    );

    // Pre-record start_sent_at as already sent
    await db.query(
      `INSERT INTO session_alerts (session_id, household_id, child_id, started_at, start_sent_at)
       VALUES ($1, $2, $3, $4, $4);`,
      [sessionId, householdId, childId, startedAt]
    );

    const body = { dryRun: false };
    const headers = makeAuthHeaders(body);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers,
      payload: body
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.success, true);
    assert.equal(data.count, 1);
    assert.equal(data.targets.length, 1);

    const target = data.targets[0];
    assert.equal(target.alertType, 'thirty');
    assert.equal(target.sessionId, sessionId);
    assert.equal(target.recipientPhone, '919876543210');
    assert.equal(target.templateName, 'appu_child_session_30min');
    assert.equal(target.templateLanguage, 'en');

    // Verify thirty_sent_at is now set
    const alertRow = await db.query(
      `SELECT session_id, start_sent_at, thirty_sent_at FROM session_alerts WHERE session_id = $1;`,
      [sessionId]
    );
    assert.equal(alertRow.rows.length, 1);
    assert.ok(alertRow.rows[0].thirty_sent_at);

    // Subsequent call returns 0 targets
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers: makeAuthHeaders(body),
      payload: body
    });
    assert.equal(res2.json().count, 0);
  });

  test('4. Honors dryRun: true without mutating session_alerts', async () => {
    const sessionId = crypto.randomUUID();
    const startedAt = new Date(Date.now() - 4 * 60 * 1000); // 4 min ago

    await db.query(
      `INSERT INTO conversation_sessions (id, household_id, child_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, 'Science revision', $4, $4);`,
      [sessionId, householdId, childId, startedAt]
    );

    const body = { dryRun: true };
    const headers = makeAuthHeaders(body);

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers,
      payload: body
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.success, true);
    assert.equal(data.count, 1);

    // Verify NO row was created in session_alerts
    const alertRow = await db.query(
      `SELECT * FROM session_alerts WHERE session_id = $1;`,
      [sessionId]
    );
    assert.equal(alertRow.rows.length, 0);
  });

  test('5. Excludes sessions from households without WhatsApp consent', async () => {
    // Revoke consent
    await db.query(
      `UPDATE households SET whatsapp_consent = FALSE WHERE id = $1;`,
      [householdId]
    );

    const sessionId = crypto.randomUUID();
    const startedAt = new Date(Date.now() - 3 * 60 * 1000);

    await db.query(
      `INSERT INTO conversation_sessions (id, household_id, child_id, title, created_at, updated_at)
       VALUES ($1, $2, $3, 'History reading', $4, $4);`,
      [sessionId, householdId, childId, startedAt]
    );

    const body = { dryRun: false };
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/whatsapp/proactive/child-session-alert',
      headers: makeAuthHeaders(body),
      payload: body
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().count, 0);
    assert.equal(res.json().targets.length, 0);
  });
});
