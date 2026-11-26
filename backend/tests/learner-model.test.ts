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

import { LearnerModelService, applyAnswer, statusFor, topicKey } from '../src/domain/learner-model/index.js';

const NOW = new Date('2026-11-26T10:00:00Z');

describe('Learner model: mastery rules', () => {
  test('topic names that differ only in case, spacing or punctuation are one topic', () => {
    assert.equal(topicKey('  Photosynthesis! '), topicKey('photosynthesis'));
    assert.notEqual(topicKey('Fractions'), topicKey('Decimals'));
    assert.equal(topicKey('ಪ್ರಕಾಶಸಂಶ್ಲೇಷಣೆ'), 'ಪ್ರಕಾಶಸಂಶ್ಲೇಷಣೆ');
  });

  test('one answer never decides a topic; mastery needs a run of right answers', () => {
    assert.equal(statusFor('1'), 'starting');
    assert.equal(statusFor('0'), 'starting');
    assert.equal(statusFor('10'), 'practising');
    assert.equal(statusFor('0011'), 'practising'); // 50%
    assert.equal(statusFor('0111'), 'secure');
    assert.equal(statusFor('1110'), 'practising', 'a fresh mistake pulls a topic back to practice');
    assert.equal(statusFor('11111'), 'mastered');
    assert.equal(statusFor('10111'), 'secure', '80% is not yet mastered');
  });

  test('applyAnswer keeps the last 8 results, remembers the latest mistake and schedules a review', () => {
    let m: any = null;
    for (const ok of [false, true, true, true, true, true, true, true, true]) {
      m = applyAnswer(m, ok, ok ? null : 'What is 3/4 as a decimal?', NOW);
    }
    assert.equal(m.attempts, 9);
    assert.equal(m.correct, 8);
    assert.equal(m.recent, '11111111');
    assert.equal(m.status, 'mastered');
    assert.equal(m.lastMistake, 'What is 3/4 as a decimal?');
    assert.equal(m.nextReviewAt.getTime() - NOW.getTime(), 7 * 24 * 3600 * 1000);
    const wrong = applyAnswer(m, false, 'Convert 1/8', NOW);
    assert.equal(wrong.status, 'secure');
    assert.equal(wrong.lastMistake, 'Convert 1/8');
  });

  test('the brain note lists weak topics first, strong topics, reviews and the preferred way of learning', () => {
    const t = (topic: string, recent: string, extra: any = {}) => ({
      topicKey: topicKey(topic), topic, attempts: recent.length, correct: 0, recent,
      status: statusFor(recent), lastMistake: null, lastSeenAt: NOW, nextReviewAt: new Date(NOW.getTime() + 864e5), ...extra
    });
    const model = LearnerModelService.summarise(
      [
        t('Fractions', '0101', { lastMistake: 'What is 1/2 + 1/4?' }),
        t('Decimals', '0001'),
        t('Photosynthesis', '11111', { nextReviewAt: new Date(NOW.getTime() - 1000) })
      ],
      [{ mode: 'see', n: 5 }, { mode: 'diagram', n: 2 }, { mode: 'quiz', n: 3 }, { mode: 'audio', n: 1 }],
      NOW
    );
    assert.deepEqual(model.needsPractice.map((x) => x.topic), ['Decimals', 'Fractions']);
    assert.deepEqual(model.strong.map((x) => x.topic), ['Photosynthesis']);
    assert.deepEqual(model.dueForReview.map((x) => x.topic), ['Photosynthesis']);
    assert.deepEqual(model.learnsBestWith, ['pictures and step-by-step visuals', 'practice questions']);
    const note = LearnerModelService.promptNote(model);
    assert.match(note, /Needs practice: Decimals \(1 of 4 right\); Fractions \(2 of 4 right; missed: "What is 1\/2 \+ 1\/4\?"\)/);
    assert.match(note, /Secure or mastered: Photosynthesis/);
    assert.match(note, /Learns best with: pictures and step-by-step visuals, then practice questions/);
    assert.match(note, /HOW TO ADAPT/);
  });

  test('no measured data means no note (the brain is not told made-up things)', () => {
    assert.equal(LearnerModelService.promptNote(LearnerModelService.summarise([], [], NOW)), '');
  });
});

describe('Learner model: consent, evidence and the brain', () => {
  let db: TransactionalQueryable;
  let app: ReturnType<typeof buildApp>;
  let brain: MockN8nClient;
  let householdId: string;
  let childId: string;
  const token = 'token-learning-parent';
  const auth = { authorization: `Bearer ${token}` };

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);
    const userId = crypto.randomUUID();
    const authVerifier = new MockAuthVerifier();
    authVerifier.registerToken(token, { userId, email: 'parent@example.com' });
    brain = new MockN8nClient();
    app = buildApp(loadConfig({ NODE_ENV: 'test', APPU_BETA_MODE: 'true', APPU_BETA_CHAT_LIMIT: '30' }), {
      database: db,
      authVerifier,
      razorpayClient: new MockRazorpayClient({ keyId: 'test', keySecret: 'test' }),
      n8nClient: brain
    });
    const household = await TenancyRepository.createHousehold(db, { name: 'Rao Family' });
    householdId = household.id;
    await TenancyRepository.createHouseholdMember(db, { householdId, userId, role: 'OWNER' });
    childId = (await TenancyRepository.createChildProfile(db, { householdId, preferredName: 'Meena', gradeBand: '6' })).id;
  });

  const post = (events: any[]) =>
    app.inject({ method: 'POST', url: '/api/appu/learning/events', headers: auth, payload: { childId, events } });
  const consent = (granted: boolean) =>
    app.inject({ method: 'PUT', url: `/api/children/${childId}/learning-consent`, headers: auth, payload: { granted } });
  const profile = async () =>
    JSON.parse((await app.inject({ method: 'GET', url: `/api/children/${childId}/learning`, headers: auth })).body);
  const fractionsWrongTwice = [
    { source: 'lesson_quiz', topic: 'Fractions', isCorrect: false, question: 'What is 1/2 + 1/4?' },
    { source: 'lesson_quiz', topic: 'fractions', isCorrect: true },
    { source: 'lesson_quiz', topic: 'Fractions', isCorrect: false, question: 'What is 2/3 of 9?' },
    { source: 'mode_open', topic: 'Fractions', mode: 'see' }
  ];

  test('nothing is recorded until a parent switches learning tracking on', async () => {
    const res = await post(fractionsWrongTwice);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).recorded, 0);
    assert.deepEqual((await profile()).consent, { granted: false, decided: false });
    const rows = await db.query('SELECT COUNT(*) AS n FROM learning_events');
    assert.equal(Number(rows.rows[0].n), 0);
  });

  test('with consent, lesson answers build the topic record the parent can see', async () => {
    assert.equal((await consent(true)).statusCode, 200);
    assert.equal(JSON.parse((await post(fractionsWrongTwice)).body).recorded, 4);
    const p = await profile();
    assert.equal(p.consent.granted, true);
    assert.equal(p.topics.length, 1);
    assert.equal(p.topics[0].topic, 'Fractions');
    assert.equal(p.topics[0].attempts, 3);
    assert.equal(p.topics[0].recent, '010');
    assert.equal(p.topics[0].status, 'practising');
    assert.equal(p.topics[0].lastMistake, 'What is 2/3 of 9?');
    assert.deepEqual(p.model.learnsBestWith, ['pictures and step-by-step visuals']);
  });

  test('the brain receives the learner note with the message, and only for consented children', async () => {
    const ask = () =>
      app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: { ...auth, 'idempotency-key': crypto.randomUUID() },
        payload: { childId, message: 'Explain fractions again please' }
      });
    const first = await ask();
    assert.equal(first.statusCode, 200, first.body);
    assert.doesNotMatch(brain.lastEnvelope!.quizProtocol || '', /LEARNER MODEL/);

    await consent(true);
    await post(fractionsWrongTwice);
    assert.equal((await ask()).statusCode, 200);
    const sent = brain.lastEnvelope!.quizProtocol || '';
    assert.match(sent, /LEARNER MODEL/);
    assert.match(sent, /Needs practice: Fractions \(1 of 3 right; missed: "What is 2\/3 of 9\?"\)/);
    assert.match(sent, /QUIZ/i, 'the quiz protocol is still sent');
  });

  test('switching tracking off deletes everything recorded for the child', async () => {
    await consent(true);
    await post(fractionsWrongTwice);
    assert.equal((await consent(false)).statusCode, 200);
    for (const table of ['learning_events', 'learner_topic_mastery']) {
      const r = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
      assert.equal(Number(r.rows[0].n), 0, table);
    }
    // The parent's "no" is remembered, and nothing more is recorded.
    assert.deepEqual((await profile()).consent, { granted: false, decided: true });
    assert.equal(JSON.parse((await post(fractionsWrongTwice)).body).recorded, 0);
  });

  test('another family cannot read or write this child', async () => {
    const other = await TenancyRepository.createHousehold(db, { name: 'Other' });
    const otherChild = await TenancyRepository.createChildProfile(db, { householdId: other.id, preferredName: 'X', gradeBand: '6' });
    const res = await app.inject({ method: 'PUT', url: `/api/children/${otherChild.id}/learning-consent`, headers: auth, payload: { granted: true } });
    assert.equal(res.statusCode, 404);
    const r2 = await app.inject({ method: 'POST', url: '/api/appu/learning/events', headers: auth, payload: { childId: otherChild.id, events: fractionsWrongTwice } });
    assert.equal(r2.statusCode, 404);
  });

  test('bad input is rejected', async () => {
    assert.equal((await post([{ source: 'hack', topic: 'x' }])).statusCode, 400);
    assert.equal((await post([])).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: `/api/children/${childId}/learning` })).statusCode, 401);
  });
});
