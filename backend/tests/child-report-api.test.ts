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
import { FamilyFeedbackService } from '../src/domain/feedback/index.js';
import { ConversationRepository } from '../src/domain/conversation/repository.js';

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

describe('Child Performance Report API & Gating', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let app: ReturnType<typeof buildApp>;
  let userId: string;
  let householdId: string;
  let childId: string;
  const token = 'token-report-parent-123';

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
    const household = await TenancyRepository.createHousehold(db, { name: 'Sharma Family' });
    householdId = household.id;
    await TenancyRepository.createHouseholdMember(db, {
      householdId: household.id,
      userId,
      role: 'OWNER'
    });

    // Create child profile
    const child = await TenancyRepository.createChildProfile(db, {
      householdId: household.id,
      preferredName: 'Aarav',
      gradeBand: '6',
      nickname: 'Aaru'
    });
    childId = child.id;

    // Create a conversation session and messages
    const session = await ConversationRepository.create(
      db,
      household.id,
      child.id,
      'Fractions and Decimals Study'
    );
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, role, text)
       VALUES ($1, 'user', 'Can you explain how to convert 3/4 to a decimal?'),
              ($1, 'assistant', 'To convert 3/4 to a decimal, divide 3 by 4. 3 divided by 4 equals 0.75!')`,
      [session.id]
    );
  });

  test('POST /api/children/:childId/report rejects unauthenticated with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/report`
    });

    assert.equal(res.statusCode, 401);
  });

  test('POST /api/children/:childId/report gates when no feedback exists (returns 403 feedback_required)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/report`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'forbidden');
    assert.equal(body.reason, 'feedback_required');
    assert.ok(body.message.includes('feedback is required'));
  });

  test('POST /api/children/:childId/report?format=json succeeds after feedback submission', async () => {
    // Unlock by submitting feedback
    await FamilyFeedbackService.saveFeedback(db, householdId, {
      rating: 5,
      whatsWorking: 'Helpful tutoring'
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/report?format=json`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 200);
    const report = JSON.parse(res.body);

    assert.equal(report.childName, 'Aaru');
    assert.equal(report.grade, '6');
    assert.equal(report.period, 'cumulative');
    assert.ok(typeof report.overallScore === 'number');
    assert.ok(report.overallScore >= 0 && report.overallScore <= 100);
    assert.ok(typeof report.scoreLabel === 'string');
    assert.ok(typeof report.summary === 'string');
    assert.ok(Array.isArray(report.subjects));
    assert.ok(Array.isArray(report.strengths));
    assert.ok(Array.isArray(report.improvements));
    assert.ok(Array.isArray(report.topicsCovered));
    assert.ok(Array.isArray(report.recommendations));
    assert.ok(report.engagement);
    assert.equal(report.engagement.totalChats, 1);
    assert.ok(report.engagement.activeDays >= 1);
  });

  test('POST /api/children/:childId/report generates designed PDF attachment by default', async () => {
    // Unlock by submitting feedback
    await FamilyFeedbackService.saveFeedback(db, householdId, {
      rating: 5
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/report`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.ok(res.headers['content-disposition']?.includes('attachment; filename="appu-progress-report-aaru-'));
    assert.ok(res.rawPayload.length > 500);

    // Verify PDF header magic bytes '%PDF-'
    const pdfMagic = res.rawPayload.subarray(0, 5).toString('ascii');
    assert.equal(pdfMagic, '%PDF-');
  });

  test('Cross-household child access is blocked', async () => {
    // Create Household B and a separate child
    const otherHousehold = await TenancyRepository.createHousehold(db, { name: 'Other Family' });
    const otherChild = await TenancyRepository.createChildProfile(db, {
      householdId: otherHousehold.id,
      preferredName: 'Rohan',
      gradeBand: '8'
    });

    // Parent from Household A attempts to generate report for child from Household B
    await FamilyFeedbackService.saveFeedback(db, householdId, { rating: 5 });

    const res = await app.inject({
      method: 'POST',
      url: `/api/children/${otherChild.id}/report`,
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 404);
  });
});
