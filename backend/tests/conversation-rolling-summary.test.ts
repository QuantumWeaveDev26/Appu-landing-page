import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { TenancyRepository } from '../src/domain/tenancy/repository.js';
import { WhatsAppContextService } from '../src/domain/whatsapp/context-service.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { MockN8nClient } from '../src/domain/gateway/index.js';
import { SubscriptionService } from '../src/domain/subscription/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../src/domain/auth/types.js';
import {
  ConversationRepository,
  compactSessionMemory,
  sanitizeSummary,
  ROLLING_SUMMARY_SYSTEM_PROMPT
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

describe('APPU Conversation Rolling Summary & Memory Compaction Suite', () => {
  let db: TransactionalQueryable;
  let householdId: string;
  let childId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    const setup = await TenancyService.createHouseholdWithOwner(db, {
      userId: crypto.randomUUID(),
      householdName: 'Rolling Memory Test Household'
    });
    householdId = setup.household.id;

    const childRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdId, 'Aarav', 'Grade 5']
    );
    childId = childRes.rows[0].id;
  });

  test('sanitizeSummary strips markdown symbols and collapses whitespace', () => {
    const raw = '## Key Concepts\n* **Fractions**: Learner understood 1/2 + 1/4 = 3/4.\n\n\n- Open question: division.';
    const sanitized = sanitizeSummary(raw);
    assert.equal(sanitized.includes('*'), false);
    assert.equal(sanitized.includes('#'), false);
    assert.equal(sanitized.includes('**'), false);
    assert.match(sanitized, /Fractions: Learner understood/);
  });

  test('short session (<= tailLimit) returns verbatim history and empty summary without LLM call', async () => {
    const conv = await ConversationRepository.create(db, householdId, childId, 'Short Math Chat');

    // Append 4 turns (8 messages)
    for (let i = 1; i <= 4; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() + INTERVAL '${i * 2 - 1} seconds'),
                ($1, 'assistant', $3, NOW() + INTERVAL '${i * 2} seconds')`,
        [conv.id, `User message ${i}`, `Assistant message ${i}`]
      );
    }

    let fetchCalled = false;
    const mockFetch = (async () => {
      fetchCalled = true;
      throw new Error('Should not be called for short sessions');
    }) as unknown as typeof fetch;

    const result = await compactSessionMemory(db, householdId, childId, conv.id, {
      tailLimit: 20,
      openaiApiKey: 'test-key',
      fetchFn: mockFetch
    });

    assert.equal(fetchCalled, false);
    assert.equal(result.conversationHistory.length, 8);
    assert.equal(result.sessionSummary, '');
    assert.equal(result.conversationHistory[0].text, 'User message 1');
    assert.equal(result.conversationHistory[7].text, 'Assistant message 4');
  });

  test('long session (> tailLimit) compacts older turns using gpt-4.1-mini and preserves recent tail', async () => {
    const conv = await ConversationRepository.create(db, householdId, childId, 'Long Physics Chat');

    // Create 12 turns (24 messages)
    for (let i = 1; i <= 12; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() + INTERVAL '${i * 2 - 1} seconds'),
                ($1, 'assistant', $3, NOW() + INTERVAL '${i * 2} seconds')`,
        [conv.id, `Learner question ${i}: topic ${i}`, `Appu explanation ${i}: concept ${i}`]
      );
    }

    let requestBodyCaptured: any = null;
    const mockFetch = (async (_url: string, init: any) => {
      requestBodyCaptured = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Learner Aarav explored topics 1 and 2. Mastered concepts 1 and 2.'
              }
            }
          ]
        })
      };
    }) as unknown as typeof fetch;

    const result = await compactSessionMemory(db, householdId, childId, conv.id, {
      tailLimit: 20,
      openaiApiKey: 'test-key',
      fetchFn: mockFetch
    });

    // 1. Verify model is gpt-4.1-mini
    assert.ok(requestBodyCaptured);
    assert.equal(requestBodyCaptured.model, 'gpt-4.1-mini');
    assert.equal(requestBodyCaptured.messages[0].content, ROLLING_SUMMARY_SYSTEM_PROMPT);

    // 2. Verify unsummarized older turns (messages 1..4 = first 2 turns) were sent
    assert.match(requestBodyCaptured.messages[1].content, /topic 1/);
    assert.match(requestBodyCaptured.messages[1].content, /topic 2/);
    // Recent tail (turns 3..12) should NOT be in the summarization prompt
    assert.equal(requestBodyCaptured.messages[1].content.includes('topic 3'), false);

    // 3. Verify returned tail length and summary
    assert.equal(result.conversationHistory.length, 20);
    assert.equal(result.sessionSummary, 'Learner Aarav explored topics 1 and 2. Mastered concepts 1 and 2.');
    assert.equal(result.conversationHistory[0].text, 'Learner question 3: topic 3');
    assert.equal(result.conversationHistory[19].text, 'Appu explanation 12: concept 12');

    // 4. Verify DB persistence on conversation_sessions
    const sessionRow = await ConversationRepository.getOwned(db, householdId, childId, conv.id);
    assert.ok(sessionRow);
    assert.equal(sessionRow.rollingSummary, 'Learner Aarav explored topics 1 and 2. Mastered concepts 1 and 2.');
    assert.ok(sessionRow.summarizedUpToMessageId);
    assert.ok(sessionRow.summarizedAt);
  });

  test('skips LLM call on subsequent turn when older turns are already fully summarized', async () => {
    const conv = await ConversationRepository.create(db, householdId, childId, 'Subsequent Turn Chat');

    // Insert 24 messages (12 turns)
    for (let i = 1; i <= 12; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() + INTERVAL '${i * 2 - 1} seconds'),
                ($1, 'assistant', $3, NOW() + INTERVAL '${i * 2} seconds')`,
        [conv.id, `User message ${i}`, `Assistant message ${i}`]
      );
    }

    // Perform initial compaction
    const mockFetch = (async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Initial rolling summary covering turns 1-2.' } }]
      })
    })) as unknown as typeof fetch;

    await compactSessionMemory(db, householdId, childId, conv.id, {
      tailLimit: 20,
      openaiApiKey: 'test-key',
      fetchFn: mockFetch
    });

    // Call again immediately with no new messages
    let secondFetchCalled = false;
    const failingMock = (async () => {
      secondFetchCalled = true;
      throw new Error('Should not call fetch when already summarized');
    }) as unknown as typeof fetch;

    const result2 = await compactSessionMemory(db, householdId, childId, conv.id, {
      tailLimit: 20,
      openaiApiKey: 'test-key',
      fetchFn: failingMock
    });

    assert.equal(secondFetchCalled, false);
    assert.equal(result2.sessionSummary, 'Initial rolling summary covering turns 1-2.');
    assert.equal(result2.conversationHistory.length, 20);
  });

  test('fails safe and returns verbatim tail with empty or existing summary when OpenAI fails', async () => {
    const conv = await ConversationRepository.create(db, householdId, childId, 'Failing LLM Chat');

    for (let i = 1; i <= 12; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() + INTERVAL '${i * 2 - 1} seconds'),
                ($1, 'assistant', $3, NOW() + INTERVAL '${i * 2} seconds')`,
        [conv.id, `User message ${i}`, `Assistant message ${i}`]
      );
    }

    const failingMock = (async () => {
      return {
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      };
    }) as unknown as typeof fetch;

    const result = await compactSessionMemory(db, householdId, childId, conv.id, {
      tailLimit: 20,
      openaiApiKey: 'test-key',
      fetchFn: failingMock
    });

    // Zero throws, returns last 20 messages verbatim
    assert.equal(result.conversationHistory.length, 20);
    assert.equal(result.sessionSummary, '');
    assert.equal(result.conversationHistory[0].text, 'User message 3');
  });

  test('fails safe when OPENAI_API_KEY is omitted, returning recent tail without crashing', async () => {
    const conv = await ConversationRepository.create(db, householdId, childId, 'No Key Chat');

    for (let i = 1; i <= 12; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() + INTERVAL '${i * 2 - 1} seconds'),
                ($1, 'assistant', $3, NOW() + INTERVAL '${i * 2} seconds')`,
        [conv.id, `User ${i}`, `Assistant ${i}`]
      );
    }

    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await compactSessionMemory(db, householdId, childId, conv.id, {
        tailLimit: 20,
        openaiApiKey: ''
      });

      assert.equal(result.conversationHistory.length, 20);
      assert.equal(result.sessionSummary, '');
    } finally {
      if (origKey) process.env.OPENAI_API_KEY = origKey;
    }
  });

  test('WhatsAppContextService.resolveContext includes sessionSummary and prepends it to formattedTranscript', async () => {
    // 1. Update household with parent phone and whatsapp consent
    await TenancyRepository.updateNotificationPreferences(db, householdId, {
      parentPhone: '+919876543210',
      whatsappConsent: true
    });

    // 2. Create conversation session with existing rolling summary and 4 recent messages
    const conv = await ConversationRepository.create(db, householdId, childId, 'WhatsApp Ongoing Chat');
    const msg1Res = await db.query<{ id: string }>(
      `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
       VALUES ($1, 'user', 'Old message 1', NOW() - INTERVAL '10 minutes')
       RETURNING id;`,
      [conv.id]
    );
    await ConversationRepository.updateRollingSummary(
      db,
      householdId,
      childId,
      conv.id,
      'Learner completed fraction exercises and struggled with LCM.',
      msg1Res.rows[0].id
    );

    // Insert 2 recent turns
    for (let i = 1; i <= 2; i++) {
      await db.query(
        `INSERT INTO conversation_messages (conversation_id, role, text, created_at)
         VALUES ($1, 'user', $2, NOW() - INTERVAL '${5 - i} minutes'),
                ($1, 'assistant', $3, NOW() - INTERVAL '${4 - i} minutes')`,
        [conv.id, `Recent user question ${i}`, `Recent assistant answer ${i}`]
      );
    }

    // 3. Resolve context
    const result = await WhatsAppContextService.resolveContext(db, '+919876543210');

    assert.equal(result.recognized, true);
    assert.equal(result.sessionSummary, 'Learner completed fraction exercises and struggled with LCM.');
    assert.ok(result.formattedTranscript);
    assert.match(
      result.formattedTranscript,
      /^Session memory summary:\nLearner completed fraction exercises and struggled with LCM\.\n\nPrior conversation transcript/
    );
    assert.match(result.formattedTranscript, /Recent user question 1/);
    assert.match(result.formattedTranscript, /Recent assistant answer 2/);
  });
});

class TestAuthVerifier implements AuthVerifier {
  private users = new Map<string, AuthenticatedPrincipal>();
  registerUser(token: string, principal: AuthenticatedPrincipal) {
    this.users.set(token, principal);
  }
  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    const user = this.users.get(token);
    if (!user) {
      throw new Error('Unauthorized');
    }
    return user;
  }
}

describe('APPU 15-Turn Gateway Integration Suite (End-to-End Behavioral Recall)', () => {
  let db: TransactionalQueryable;
  let authVerifier: TestAuthVerifier;
  let n8nClient: MockN8nClient;
  let app: any;
  let householdId: string;
  let childId: string;
  const parentToken = 'Bearer token_15_turn_parent';
  const authHeaders = { authorization: parentToken };
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db);

    await SubscriptionService.syncPlans(db, {
      evolve_monthly: 'plan_evolve_mo_test',
      evolve_annual: 'plan_evolve_yr_test',
      evolve_plus_monthly: 'plan_evolve_plus_mo_test',
      evolve_plus_annual: 'plan_evolve_plus_yr_test',
      genesis_monthly: 'plan_genesis_mo_test',
      genesis_annual: 'plan_genesis_yr_test'
    });

    authVerifier = new TestAuthVerifier();
    const parentUserId = crypto.randomUUID();
    authVerifier.registerUser('token_15_turn_parent', {
      userId: parentUserId,
      email: 'turn15_parent@test.com'
    });

    const { household } = await TenancyService.createHouseholdWithOwner(db, {
      userId: parentUserId,
      email: 'turn15_parent@test.com',
      householdName: '15-Turn Test Household'
    });
    householdId = household.id;

    const plan = await SubscriptionRepository.getPlanByCode(db, 'evolve_plus_monthly');
    await SubscriptionRepository.createSubscription(db, {
      householdId,
      planId: plan!.id,
      provider: 'razorpay',
      providerSubscriptionId: `sub_rzp_${crypto.randomUUID()}`,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000)
    });

    const cRes = await db.query<{ id: string }>(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING id`,
      [householdId, 'Aarav', 'Grade 5']
    );
    childId = cRes.rows[0].id;

    n8nClient = new MockN8nClient();

    const config = loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      N8N_APPU_WEBHOOK_URL: 'https://n8n.example.com/webhook/test',
      OPENAI_API_KEY: 'test-openai-key'
    });

    app = buildApp(config, {
      database: db as any,
      authVerifier,
      n8nClient
    });
  });

  test('15-turn session: turn 1 facts are compacted into sessionSummary and recalled at turn 15 after rolling out of tail', async () => {
    let compactionCallCount = 0;
    let interceptedPrompt = '';

    globalThis.fetch = (async (input: any, init: any) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (url === 'https://api.openai.com/v1/chat/completions') {
        compactionCallCount++;
        const parsedBody = JSON.parse(init.body);
        interceptedPrompt = parsedBody.messages[1].content;
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content:
                    'Learner Aarav favorite dinosaur is Ankylosaurus. Learning goal is prime numbers (2, 3, 5, 7).'
                }
              }
            ]
          })
        };
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      // 1. Send Turn 1 establishing a specific memorable fact (Ankylosaurus)
      n8nClient.nextResponse = {
        text: 'Hello Aarav! Ankylosaurus is an armored giant! Ready to learn about prime numbers?',
        audioSource: null,
        audioDurationMs: null
      };

      const turn1Res = await app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: authHeaders,
        payload: {
          childId,
          message: 'My favorite dinosaur is Ankylosaurus and today I want to master prime numbers!'
        }
      });
      assert.equal(turn1Res.statusCode, 200);
      const conversationId = turn1Res.json().conversationId;
      assert.ok(conversationId);

      // At turn 1, sessionSummary should be empty (fits in tail of 20)
      assert.equal(n8nClient.lastEnvelope?.sessionSummary, '');
      assert.equal(n8nClient.lastEnvelope?.conversationHistory?.length, 0);

      // 2. Send Turns 2 through 14 (each turn adds 2 messages to history)
      for (let turn = 2; turn <= 14; turn++) {
        n8nClient.nextResponse = {
          text: `Appu reply for turn ${turn}: continuing lesson on factors and primes.`,
          audioSource: null,
          audioDurationMs: null
        };

        const res = await app.inject({
          method: 'POST',
          url: '/api/appu/message',
          headers: authHeaders,
          payload: {
            childId,
            conversationId,
            message: `Learner question for turn ${turn}: what about number ${turn}?`
          }
        });
        assert.equal(res.statusCode, 200);
      }

      // At this point, 14 turns have been completed (28 messages in DB).
      // Compaction must have run when history exceeded 20 messages.
      assert.ok(compactionCallCount >= 1, 'Compaction should have been triggered');
      assert.match(interceptedPrompt, /Ankylosaurus/);

      // 3. Send Turn 15: Recall question asking about Turn 1
      n8nClient.nextResponse = {
        text: 'Your favorite dinosaur is the armored Ankylosaurus!',
        audioSource: null,
        audioDurationMs: null
      };

      const turn15Res = await app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: authHeaders,
        payload: {
          childId,
          conversationId,
          message: 'Which dinosaur did I say was my favorite back at the start?'
        }
      });
      assert.equal(turn15Res.statusCode, 200);

      // 4. Verify Turn 15 Envelope delivered to n8n
      const env = n8nClient.lastEnvelope!;
      assert.ok(env);
      assert.equal(env.conversationId, conversationId);

      // A. conversationHistory tail is bounded to 20 messages (turns 5-14)
      assert.equal(env.conversationHistory?.length, 20);

      // B. Turn 1 text is NOT in conversationHistory because it rolled out of the 20-message tail
      const turn1InTail = env.conversationHistory?.some((m) => m.text.includes('Ankylosaurus'));
      assert.equal(turn1InTail, false, 'Turn 1 must have rolled out of the 20-message tail');

      // C. Turn 1 fact IS preserved in sessionSummary!
      assert.ok(env.sessionSummary);
      assert.match(env.sessionSummary, /Ankylosaurus/);
      assert.match(env.sessionSummary, /prime numbers/i);

      // D. Verify n8n normalized transcript assembly
      const n8nAssembledTranscript =
        `Session memory summary:\n${env.sessionSummary}\n\n` +
        `Prior conversation transcript:\n` +
        env.conversationHistory?.map((m) => `${m.role}: ${m.text}`).join('\n');

      assert.match(n8nAssembledTranscript, /Session memory summary:/);
      assert.match(n8nAssembledTranscript, /Ankylosaurus/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
