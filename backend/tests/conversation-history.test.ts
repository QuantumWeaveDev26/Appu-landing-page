import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import type { AuthVerifier } from '../src/domain/auth/types.js';
import {
  ConversationRepository,
  ConversationService,
  type ConversationSession,
  type ConversationMessage,
  type ConversationSummary,
  type ConversationHistoryEntry
} from '../src/domain/conversation/index.js';

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
      try {
        await client.query('BEGIN');
        const clientQuery = (text: string, params?: any[]) => {
          let t = text;
          if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
            t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
          }
          return client.query(t, params);
        };
        const transactionDb: Queryable = {
          async query<TResult = any>(queryText: string, values: any[] = []) {
            const result = await clientQuery(queryText, values);
            return {
              rows: result.rows as TResult[],
              rowCount: result.rowCount
            };
          }
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

async function createTestAppuRequest(db: Queryable, requestId: string): Promise<void> {
  const guestSessionId = `gst_${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 60);
  await db.query(
    `INSERT INTO guest_sessions (id, ip_hash, expires_at)
     VALUES ($1, 'dummy_ip_hash', NOW() + INTERVAL '1 day')
     ON CONFLICT (id) DO NOTHING`,
    [guestSessionId]
  );
  await db.query(
    `INSERT INTO appu_requests (
       id, actor_type, guest_session_id, idempotency_key, request_fingerprint, status
     ) VALUES ($1, 'guest', $2, $3, $4, 'PENDING')`,
    [requestId, guestSessionId, `idemp_${requestId}`, `fp_${requestId}`]
  );
}

describe('APPU Conversation History Domain & Repository Suite', () => {
  let db: TransactionalQueryable;
  let householdA: string;
  let householdB: string;
  let childA: string;
  let siblingChild: string;
  let childB: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const { household: hA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      email: 'parent-a@example.com',
      householdName: 'Household A'
    });
    householdA = hA.id;

    const { household: hB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      email: 'parent-b@example.com',
      householdName: 'Household B'
    });
    householdB = hB.id;

    const cARes = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdA, 'Child A', 'Grade 5']
    );
    childA = cARes.rows[0].id;

    const cSibRes = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdA, 'Sibling Child', 'Grade 7']
    );
    siblingChild = cSibRes.rows[0].id;

    const cBRes = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdB, 'Child B', 'Grade 6']
    );
    childB = cBRes.rows[0].id;
  });

  test('lists only owned non-expired conversations newest first and limits results to 30', async () => {
    for (let i = 1; i <= 35; i++) {
      const title = i === 35 ? 'Newest conversation' : `Conversation ${i}`;
      const session = await ConversationRepository.create(db, householdA, childA, title);
      await db.query(
        'UPDATE conversation_sessions SET updated_at = $1 WHERE id = $2',
        [new Date(Date.now() - (35 - i) * 1000), session.id]
      );
    }

    const expiredSession = await ConversationRepository.create(db, householdA, childA, 'Expired conversation');
    await db.query(
      'UPDATE conversation_sessions SET expires_at = $1 WHERE id = $2',
      [new Date(Date.now() - 10000), expiredSession.id]
    );

    await ConversationRepository.create(db, householdB, childB, 'Child B conversation');

    const rows = await ConversationRepository.listRecent(db, householdA, childA, 30);
    assert.equal(rows.length, 30);
    assert.equal(rows[0].title, 'Newest conversation');
    assert.ok(rows.every((row) => row.householdId === householdA && row.childId === childA));
  });

  test('appendSuccessfulExchange stores text and attachment marker without image bytes', async () => {
    const session = await ConversationRepository.create(db, householdA, childA, 'New conversation');
    const conversationId = session.id;
    const requestId = crypto.randomUUID();

    await createTestAppuRequest(db, requestId);

    await ConversationService.appendSuccessfulExchange(db, {
      householdId: householdA,
      childId: childA,
      conversationId,
      requestId,
      userText: 'What is shown here?',
      assistantText: 'This shows a triangle.',
      hasImageAttachment: true
    });

    const messages = await ConversationRepository.listMessages(db, householdA, childA, conversationId, 100);
    assert.deepEqual(
      messages.map(({ role, text, hasImageAttachment }) => ({ role, text, hasImageAttachment })),
      [
        { role: 'user', text: 'What is shown here?', hasImageAttachment: true },
        { role: 'assistant', text: 'This shows a triangle.', hasImageAttachment: false }
      ]
    );
    assert.ok(messages.every((message) => !('imageBase64' in message)));
    assert.ok(messages.every((message) => !('audio' in message)));

    const updatedSession = await ConversationRepository.getOwned(db, householdA, childA, conversationId);
    assert.equal(updatedSession?.title, 'What is shown here?');
  });

  test('deleting one conversation cannot delete a sibling conversation', async () => {
    const siblingSession = await ConversationRepository.create(db, householdA, siblingChild, 'Sibling chat');
    const siblingConversationId = siblingSession.id;

    const deleted = await ConversationRepository.deleteOwned(db, householdA, childA, siblingConversationId);
    assert.equal(deleted, false);
    assert.ok(await ConversationRepository.getOwned(db, householdA, siblingChild, siblingConversationId));
  });

  test('deleteExpired removes only expired conversations in bounded batches', async () => {
    const activeSession = await ConversationRepository.create(db, householdA, childA, 'Active conversation');

    for (let i = 1; i <= 3; i++) {
      const s = await ConversationRepository.create(db, householdA, childA, `Expired ${i}`);
      await db.query(
        'UPDATE conversation_sessions SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 50000), s.id]
      );
    }

    const deleted = await ConversationRepository.deleteExpired(db, 2);
    assert.equal(deleted, 2);
    const remaining = await ConversationRepository.listRecent(db, householdA, childA, 30);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, activeSession.id);
  });

  test('listContext returns at most latest 8 turns (16 messages) ascending', async () => {
    const session = await ConversationRepository.create(db, householdA, childA, 'Context test');
    for (let turn = 1; turn <= 10; turn++) {
      const reqId = crypto.randomUUID();
      await createTestAppuRequest(db, reqId);
      await ConversationService.appendSuccessfulExchange(db, {
        householdId: householdA,
        childId: childA,
        conversationId: session.id,
        requestId: reqId,
        userText: `Question ${turn}`,
        assistantText: `Answer ${turn}`,
        hasImageAttachment: false
      });
    }

    const context = await ConversationRepository.listContext(db, householdA, childA, session.id, 8);
    assert.equal(context.length, 16);
    assert.equal(context[0].role, 'user');
    assert.equal(context[0].text, 'Question 3');
    assert.equal(context[15].role, 'assistant');
    assert.equal(context[15].text, 'Answer 10');
  });

  test('deleteAllOwned deletes all conversations for the specific child only', async () => {
    await ConversationRepository.create(db, householdA, childA, 'Chat 1');
    await ConversationRepository.create(db, householdA, childA, 'Chat 2');
    await ConversationRepository.create(db, householdA, siblingChild, 'Sibling Chat');

    const count = await ConversationRepository.deleteAllOwned(db, householdA, childA);
    assert.equal(count, 2);

    const childARows = await ConversationRepository.listRecent(db, householdA, childA, 30);
    assert.equal(childARows.length, 0);

    const siblingRows = await ConversationRepository.listRecent(db, householdA, siblingChild, 30);
    assert.equal(siblingRows.length, 1);
  });

  test('createAndPrune bounds conversation count to 30 for child', async () => {
    for (let i = 1; i <= 32; i++) {
      await ConversationService.createAndPrune(db, householdA, childA, `Chat ${i}`);
    }

    const list = await ConversationRepository.listRecent(db, householdA, childA, 50);
    assert.equal(list.length, 30);
    const titles = list.map((c) => c.title);
    assert.ok(!titles.includes('Chat 1'));
    assert.ok(!titles.includes('Chat 2'));
    assert.ok(titles.includes('Chat 32'));
  });

  test('resolveOwnedOrLatest returns requested conversation or latest or creates new', async () => {
    const created = await ConversationService.resolveOwnedOrLatest(db, householdA, childA);
    assert.ok(created.id);
    assert.equal(created.title, 'New conversation');

    const latest = await ConversationService.resolveOwnedOrLatest(db, householdA, childA);
    assert.equal(latest.id, created.id);

    const explicit = await ConversationService.resolveOwnedOrLatest(db, householdA, childA, created.id);
    assert.equal(explicit.id, created.id);

    await assert.rejects(
      async () => {
        await ConversationService.resolveOwnedOrLatest(db, householdA, childA, crypto.randomUUID());
      },
      /Conversation not found/
    );
  });

  test('normalizeTitle trims, collapses whitespace, caps at 120 chars, and handles empty input', () => {
    assert.equal(ConversationService.normalizeTitle('   Hello   world!   '), 'Hello world!');
    assert.equal(ConversationService.normalizeTitle(''), 'New conversation');
    assert.equal(ConversationService.normalizeTitle(undefined, true), 'Homework photo');
    assert.equal(ConversationService.normalizeTitle(undefined, false), 'New conversation');
    const longText = 'a'.repeat(200);
    assert.equal(ConversationService.normalizeTitle(longText).length, 120);
  });
});

class TestAuthVerifier implements AuthVerifier {
  private users = new Map<string, { userId: string; email: string }>();

  public registerUser(token: string, user: { userId: string; email: string }) {
    this.users.set(token, user);
  }

  public async verifyAccessToken(token: string) {
    const user = this.users.get(token);
    if (!user) throw new Error('Invalid token');
    return {
      userId: user.userId,
      email: user.email
    };
  }
}

describe('APPU Conversation REST API Suite', () => {
  let db: TransactionalQueryable;
  let authVerifier: TestAuthVerifier;
  let app: any;
  let householdA: string;
  let householdB: string;
  let childA: string;
  let childB: string;
  const parentAToken = 'Bearer token_parent_a';
  const parentBToken = 'Bearer token_parent_b';
  const authA = { authorization: parentAToken };
  const authB = { authorization: parentBToken };

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    const parentAId = crypto.randomUUID();
    const parentBId = crypto.randomUUID();

    authVerifier.registerUser('token_parent_a', { userId: parentAId, email: 'parent_a@test.com' });
    authVerifier.registerUser('token_parent_b', { userId: parentBId, email: 'parent_b@test.com' });

    const { household: hA } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentAId,
      email: 'parent_a@test.com',
      householdName: 'Household A'
    });
    householdA = hA.id;

    const { household: hB } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentBId,
      email: 'parent_b@test.com',
      householdName: 'Household B'
    });
    householdB = hB.id;

    const cARes = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdA, 'Child A', 'Grade 5']
    );
    childA = cARes.rows[0].id;

    const cBRes = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdB, 'Child B', 'Grade 6']
    );
    childB = cBRes.rows[0].id;

    app = buildApp(loadConfig(), { database: db as any, authVerifier });
  });

  test('conversation API creates, lists, reopens, deletes, and clears owned chats', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/appu/conversations',
      headers: authA,
      payload: { childId: childA, firstMessage: 'Explain gravity' }
    });
    assert.equal(created.statusCode, 201);
    const id = created.json().conversation.id;

    const listed = await app.inject({
      method: 'GET',
      url: `/api/appu/conversations?childId=${childA}`,
      headers: authA
    });
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.json().conversations[0].id, id);

    const opened = await app.inject({
      method: 'GET',
      url: `/api/appu/conversations/${id}/messages?childId=${childA}`,
      headers: authA
    });
    assert.equal(opened.statusCode, 200);
    assert.deepEqual(opened.json().messages, []);

    assert.equal(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/appu/conversations/${id}?childId=${childA}`,
          headers: authA
        })
      ).statusCode,
      204
    );

    const created2 = await app.inject({
      method: 'POST',
      url: '/api/appu/conversations',
      headers: authA,
      payload: { childId: childA, firstMessage: 'Second chat' }
    });
    assert.equal(created2.statusCode, 201);

    const clearAll = await app.inject({
      method: 'DELETE',
      url: `/api/appu/conversations?childId=${childA}`,
      headers: authA
    });
    assert.equal(clearAll.statusCode, 204);

    const afterClear = await app.inject({
      method: 'GET',
      url: `/api/appu/conversations?childId=${childA}`,
      headers: authA
    });
    assert.equal(afterClear.statusCode, 200);
    assert.equal(afterClear.json().conversations.length, 0);
  });

  test('conversation API returns 404 for another child or household', async () => {
    const foreignCreated = await app.inject({
      method: 'POST',
      url: '/api/appu/conversations',
      headers: authB,
      payload: { childId: childB, firstMessage: 'Child B chat' }
    });
    assert.equal(foreignCreated.statusCode, 201);
    const foreignConversationId = foreignCreated.json().conversation.id;

    const response1 = await app.inject({
      method: 'GET',
      url: `/api/appu/conversations/${foreignConversationId}/messages?childId=${childA}`,
      headers: authA
    });
    assert.equal(response1.statusCode, 404);

    const response2 = await app.inject({
      method: 'GET',
      url: `/api/appu/conversations?childId=${childB}`,
      headers: authA
    });
    assert.equal(response2.statusCode, 404);
  });
});
