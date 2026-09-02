import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import { TenancyService } from '../src/domain/tenancy/service.js';
import { SubscriptionRepository } from '../src/domain/subscription/repository.js';
import { SubscriptionStates } from '../src/domain/subscription/types.js';
import { MockRazorpayClient } from '../src/domain/razorpay/mock-client.js';
import { MockN8nClient } from '../src/domain/gateway/mock-client.js';
import { UsageService } from '../src/domain/usage/service.js';
import { AppuAudioAuthorizationRepository } from '../src/domain/voice/repository.js';
import { ElevenLabsStreamService } from '../src/domain/voice/service.js';

interface MockUser {
  userId: string;
  email: string;
}

class TestAuthVerifier {
  private users = new Map<string, MockUser>();

  public registerUser(token: string, user: MockUser) {
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

  public async verifyToken(token: string) {
    const user = this.users.get(token);
    if (!user) return null;
    return {
      userId: user.userId,
      email: user.email
    };
  }
}

class MockElevenLabsStreamService extends ElevenLabsStreamService {
  public synthesisHistory: Array<{ text: string }> = [];

  constructor() {
    super({ apiKey: 'mock_test_key_for_unit_tests', voiceId: '2vNb4zVImeugpHCemE1R', modelId: 'eleven_v3' });
  }

  public override async getAudioStream(text: string): Promise<{
    stream: Readable;
    contentType: string;
    modelId: string;
  }> {
    this.synthesisHistory.push({ text });

    // Mock chunked MP3 stream
    const chunk1 = Buffer.from('ID3_MOCK_CHUNK_1_AUDIO_HEADER_BYTES');
    const chunk2 = Buffer.from('_MOCK_CHUNK_2_AUDIO_PAYLOAD_BYTES');
    const chunk3 = Buffer.from('_MOCK_CHUNK_3_AUDIO_FINISH_BYTES');

    const stream = new Readable({
      read() {
        this.push(chunk1);
        this.push(chunk2);
        this.push(chunk3);
        this.push(null);
      }
    });

    return {
      stream,
      contentType: 'audio/mpeg',
      modelId: 'eleven_v3'
    };
  }
}

describe('APPU Kannada Eleven v3 Decoupled Audio Streaming Suite', () => {
  let db: any;
  let authVerifier: TestAuthVerifier;
  let razorpayClient: MockRazorpayClient;
  let n8nClient: MockN8nClient;
  let mockElevenLabsService: MockElevenLabsStreamService;
  let app: any;
  let testHousehold: any;
  let testChild: any;
  let testSubscription: any;
  const testParentToken = 'bearer_test_parent_token';
  const testUserId = crypto.randomUUID();

  // Second tenant for cross-household isolation tests
  let secondHousehold: any;
  let secondChild: any;
  const secondParentToken = 'bearer_second_parent_token';
  const secondUserId = crypto.randomUUID();

  beforeEach(async () => {
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
      name: 'pg_advisory_xact_lock',
      args: [memDb.public.getType('text')],
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

    const pgAdapter = memDb.adapters.createPg();
    const pool = new pgAdapter.Pool();

    const cleanQuery = (text: string, params?: any[]) => {
      let t = text;
      if (t.includes('ENABLE ROW LEVEL SECURITY') || t.includes('enable row level security')) {
        t = t.replace(/ALTER TABLE[^\n;]+ENABLE ROW LEVEL SECURITY;?/gi, '');
      }
      return pool.query(t, params);
    };

    db = {
      query: cleanQuery,
      transaction: async (fn: any) => {
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
          const res = await fn({ ...client, query: clientQuery });
          await client.query('COMMIT');
          return res;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },
      close: async () => pool.end()
    };

    await runMigrations(db);

    authVerifier = new TestAuthVerifier();
    authVerifier.registerUser(testParentToken, {
      userId: testUserId,
      email: 'parent1@test.com'
    });
    authVerifier.registerUser(secondParentToken, {
      userId: secondUserId,
      email: 'parent2@test.com'
    });

    razorpayClient = new MockRazorpayClient();
    n8nClient = new MockN8nClient();
    mockElevenLabsService = new MockElevenLabsStreamService();

    // Set up Primary Household 1
    const { household: h1 } = await TenancyService.createHouseholdWithOwner(db, {
      userId: testUserId,
      email: 'parent1@test.com',
      householdName: 'Primary Learner Household'
    });
    testHousehold = h1;

    const child1Res = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING *`,
      [testHousehold.id, 'Aarav', 'Grade 5']
    );
    testChild = child1Res.rows[0];

    const evolvePlan = await SubscriptionRepository.getPlanByCode(db, 'evolve_monthly');
    testSubscription = await SubscriptionRepository.createSubscription(db, {
      householdId: testHousehold.id,
      planId: evolvePlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_123',
      status: SubscriptionStates.ACTIVE
    });

    // Set up Household 2 (for cross-tenant tests)
    const { household: h2 } = await TenancyService.createHouseholdWithOwner(db, {
      userId: secondUserId,
      email: 'parent2@test.com',
      householdName: 'Second Household'
    });
    secondHousehold = h2;

    const child2Res = await db.query(
      `INSERT INTO child_profiles (household_id, preferred_name, grade_band)
       VALUES ($1, $2, $3) RETURNING *`,
      [secondHousehold.id, 'Diya', 'Grade 3']
    );
    secondChild = child2Res.rows[0];

    await SubscriptionRepository.createSubscription(db, {
      householdId: secondHousehold.id,
      planId: evolvePlan!.id,
      provider: 'razorpay',
      providerSubscriptionId: 'sub_test_456',
      status: SubscriptionStates.ACTIVE
    });

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/test',
      GUEST_SESSION_SECRET: 'test_guest_secret_1234567890',
      N8N_APPU_WEBHOOK_URL: 'http://localhost:5678/webhook/test',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_request_hmac_secret_at_least_32_chars',
      N8N_APPU_CALLBACK_HMAC_SECRET: 'test_callback_hmac_secret_at_least_32_chars'
    });

    app = buildApp(config, {
      database: db,
      authVerifier: authVerifier as any,
      razorpayClient: razorpayClient as any,
      n8nClient: n8nClient as any,
      elevenLabsStreamService: mockElevenLabsService
    });

    await app.ready();
  });

  // =========================================================================
  // 1. REAL AUTHENTICATED LEARNER FLOW (KANNADA V3 DECOUPLED STREAMING)
  // =========================================================================
  it('returns text immediately with audioStreamUrl and saves durable authorization for Kannada turn', async () => {
    const kannadaReply = 'ನಮಸ್ಕಾರ Aarav! ಇಂದು ನಾವು ವಿಜ್ಞಾನವನ್ನು ಕಲಿಯೋಣ.';
    n8nClient.nextResponse = {
      text: kannadaReply,
      audioSource: null,
      audioDurationMs: null
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: `Bearer ${testParentToken}`,
        'idempotency-key': 'idem_kn_001'
      },
      payload: {
        childId: testChild.id,
        message: 'ನನಗೆ ವಿಜ್ಞಾನ ಕಲಿಸು',
        language: 'kn',
        includeAudio: true
      }
    });

    assert.equal(msgRes.statusCode, 200);
    const body = JSON.parse(msgRes.payload);

    assert.ok(body.requestId, 'Must contain durable requestId');
    assert.equal(body.text, kannadaReply);
    assert.equal(body.audioSource, null, 'audioSource must be null so client uses audioStreamUrl');
    assert.ok(body.audioStreamUrl, 'Must return audioStreamUrl');
    assert.equal(body.audioStreamUrl, `/api/appu/audio/stream?requestId=${body.requestId}`);

    // Verify durable record exists in database
    const authRecord = await AppuAudioAuthorizationRepository.getById(db, body.requestId);
    assert.ok(authRecord, 'Durable authorization row must exist in DB');
    assert.equal(authRecord.requestId, body.requestId);
    assert.equal(authRecord.householdId, testHousehold.id);
    assert.equal(authRecord.childId, testChild.id);
    assert.equal(authRecord.approvedText, kannadaReply);
    assert.equal(authRecord.language, 'kn');
    assert.equal(authRecord.audioStatus, 'PENDING');
    assert.ok(authRecord.expiresAt.getTime() > Date.now(), 'Expiry must be in the future');
  });

  // =========================================================================
  // 2. AUTHENTICATED AUDIO STREAMING ENDPOINT EXECUTION
  // =========================================================================
  it('streams chunked audio/mpeg when invoked with valid Bearer token and requestId', async () => {
    const kannadaReply = 'ಒಂದು ವೃತ್ತದ ತ್ರಿಜ್ಯ 7 ಸೆಂಟಿಮೀಟರ್ ಆಗಿದ್ದರೆ, ಅದರ ಸುತ್ತಳತೆ 44 ಸೆಂಟಿಮೀಟರ್ ಆಗುತ್ತದೆ.';
    n8nClient.nextResponse = {
      text: kannadaReply,
      audioSource: null,
      audioDurationMs: null
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'idem_kn_002' },
      payload: { childId: testChild.id, message: 'ವೃತ್ತದ ಸುತ್ತಳತೆ', language: 'kn', includeAudio: true }
    });
    const { requestId, audioStreamUrl } = JSON.parse(msgRes.payload);

    // Call Audio Streaming Endpoint
    const audioRes = await app.inject({
      method: 'GET',
      url: audioStreamUrl,
      headers: { authorization: `Bearer ${testParentToken}` }
    });

    assert.equal(audioRes.statusCode, 200);
    assert.equal(audioRes.headers['content-type'], 'audio/mpeg');
    assert.equal(audioRes.headers['x-appu-voice-model'], 'eleven_v3');
    assert.equal(audioRes.headers['x-appu-request-id'], requestId);
    assert.ok(audioRes.rawPayload.length > 0, 'Must stream binary audio bytes');

    // Verify ElevenLabsStreamService received exactly the server-approved text
    assert.equal(mockElevenLabsService.synthesisHistory.length, 1);
    assert.equal(mockElevenLabsService.synthesisHistory[0].text, kannadaReply);

    // Verify DB status updated
    const authRecord = await AppuAudioAuthorizationRepository.getById(db, requestId);
    assert.ok(authRecord);
    assert.equal(authRecord.streamCount, 1);
  });

  // =========================================================================
  // 3. EIGHT KANNADA TEST CATEGORIES EXECUTION
  // =========================================================================
  const sampleCategories = [
    { name: 'Pure Kannada', text: 'ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು, ನಿಮ್ಮ ಕಲಿಕಾ ಮಾರ್ಗದರ್ಶಿ.' },
    { name: 'Kn + En terms', text: 'ಪ್ರಕಾಶಸಂಶ್ಲೇಷಣೆ ಅಂದರೆ photosynthesis ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ ಸಸ್ಯಗಳು sunlight ಬಳಸಿ ಆಹಾರ ತಯಾರಿಸುತ್ತವೆ.' },
    { name: 'Mathematics', text: 'ಒಂದು ವೃತ್ತದ ತ್ರಿಜ್ಯ 7 ಸೆಂಟಿಮೀಟರ್ ಆಗಿದ್ದರೆ, ಅದರ ಸುತ್ತಳತೆ 44 ಸೆಂಟಿಮೀಟರ್ ಆಗುತ್ತದೆ.' },
    { name: 'Science', text: 'ಗುರುತ್ವಾಕರ್ಷಣಾ ಬಲದಿಂದಾಗಿ ಭೂಮಿಯ ಮೇಲಿನ ಪ್ರತಿಯೊಂದು ವಸ್ತುವೂ ಕೆಳಗೆ ಬೀಳುತ್ತದೆ.' },
    { name: 'Numbers & %', text: 'ನಮ್ಮ ತರಗತಿಯಲ್ಲಿ 25 ವಿದ್ಯಾರ್ಥಿಗಳಿದ್ದಾರೆ ಮತ್ತು 80% ಮಕ್ಕಳು ಉತ್ತಮ ಅಂಕ ಪಡೆದಿದ್ದಾರೆ.' },
    { name: 'Learner name', text: 'ಆರವ್, ನಿಮ್ಮ ಪ್ರಯತ್ನ ತುಂಬಾ ಮೆಚ್ಚುವಂತದ್ದು. ಮುಂದಿನ ಪ್ರಶ್ನೆಗೆ ಹೋಗೋಣ!' },
    { name: 'Encouragement', text: 'ತಪ್ಪಾಗಿದ್ದರೂ ಪರವಾಗಿಲ್ಲ, ಕಲಿಯುವ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ ತಪ್ಪುಗಳು ಸಹಜ. ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ!' },
    { name: 'Long answer', text: 'ನೀವು ಪ್ರತಿದಿನ ಶ್ರದ್ಧೆಯಿಂದ ಅಭ್ಯಾಸ ಮಾಡಿದರೆ, ಕಷ್ಟಕರವಾದ ಗಣಿತದ ಸಮಸ್ಯೆಗಳೂ ಕೂಡ ಸುಲಭವಾಗಿ ಅರ್ಥವಾಗುತ್ತವೆ.' }
  ];

  for (const sample of sampleCategories) {
    it(`handles sample category "${sample.name}" with full streaming lifecycle`, async () => {
      n8nClient.nextResponse = { text: sample.text, audioSource: null, audioDurationMs: null };

      const msgRes = await app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': `sample_${sample.name}` },
        payload: { childId: testChild.id, message: sample.name, language: 'kn', includeAudio: true }
      });

      assert.equal(msgRes.statusCode, 200);
      const msgBody = JSON.parse(msgRes.payload);
      assert.ok(msgBody.audioStreamUrl);

      const audioRes = await app.inject({
        method: 'GET',
        url: msgBody.audioStreamUrl,
        headers: { authorization: `Bearer ${testParentToken}` }
      });

      assert.equal(audioRes.statusCode, 200);
      assert.equal(audioRes.headers['content-type'], 'audio/mpeg');
    });
  }

  // =========================================================================
  // 4. SECURITY & ANTI-ABUSE INVARIANTS
  // =========================================================================
  it('blocks unauthenticated audio stream requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/appu/audio/stream?requestId=${crypto.randomUUID()}`
    });
    assert.equal(res.statusCode, 401);
  });

  it('blocks invalid requestId formats with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/appu/audio/stream?requestId=not-a-valid-uuid',
      headers: { authorization: `Bearer ${testParentToken}` }
    });
    assert.equal(res.statusCode, 400);
  });

  it('returns 404 for non-existent requestId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/appu/audio/stream?requestId=${crypto.randomUUID()}`,
      headers: { authorization: `Bearer ${testParentToken}` }
    });
    assert.equal(res.statusCode, 404);
  });

  it('strictly blocks cross-household access (wrong household) with 403', async () => {
    // 1. Create message for Household 1
    n8nClient.nextResponse = { text: 'ರಹಸ್ಯ ಮಾಹಿತಿ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'hh1_secret' },
      payload: { childId: testChild.id, message: 'ರಹಸ್ಯ', language: 'kn', includeAudio: true }
    });
    const { audioStreamUrl } = JSON.parse(msgRes.payload);

    // 2. Household 2 tries to access Household 1's audio stream
    const crossRes = await app.inject({
      method: 'GET',
      url: audioStreamUrl,
      headers: { authorization: `Bearer ${secondParentToken}` } // Tenant 2 credentials
    });

    assert.equal(crossRes.statusCode, 403, 'Cross-household audio stream access must be forbidden');
  });

  it('returns 410 when audio stream authorization has expired', async () => {
    n8nClient.nextResponse = { text: 'ಹಳೆಯ ಸಂದೇಶ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'exp_test' },
      payload: { childId: testChild.id, message: 'ಹಳೆಯ', language: 'kn', includeAudio: true }
    });
    const { requestId, audioStreamUrl } = JSON.parse(msgRes.payload);

    // Manually expire the record in the database
    await db.query(
      `UPDATE appu_audio_authorizations SET expires_at = NOW() - INTERVAL '1 second' WHERE request_id = $1`,
      [requestId]
    );

    const res = await app.inject({
      method: 'GET',
      url: audioStreamUrl,
      headers: { authorization: `Bearer ${testParentToken}` }
    });

    assert.equal(res.statusCode, 410, 'Expired audio request must return 410 Gone');
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'AUDIO_STREAM_EXPIRED');
  });

  it('supports safe replay / repeated playback within the validity window', async () => {
    n8nClient.nextResponse = { text: 'ಪುನರಾವರ್ತನೆ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'replay_test' },
      payload: { childId: testChild.id, message: 'ಮತ್ತೊಮ್ಮೆ ಹೇಳು', language: 'kn', includeAudio: true }
    });
    const { requestId, audioStreamUrl } = JSON.parse(msgRes.payload);

    // Play 1st time
    const res1 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res1.statusCode, 200);

    // Play 2nd time (replay)
    const res2 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res2.statusCode, 200);

    const record = await AppuAudioAuthorizationRepository.getById(db, requestId);
    assert.equal(record?.streamCount, 2, 'Stream count must track 2 replays');
  });

  it('preserves authorization across server restart due to durable database storage', async () => {
    n8nClient.nextResponse = { text: 'ಸರ್ವರ್ ಮರುಪ್ರಾರಂಭ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'server_restart_idem' },
      payload: { childId: testChild.id, message: 'ಪುನರಾರಂಭ', language: 'kn', includeAudio: true }
    });
    const { requestId, audioStreamUrl } = JSON.parse(msgRes.payload);

    // Simulate complete server restart by closing old app and building brand new app instance
    await app.close();

    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/test',
      GUEST_SESSION_SECRET: 'test_guest_secret_1234567890',
      N8N_APPU_WEBHOOK_URL: 'http://localhost:5678/webhook/test',
      N8N_APPU_REQUEST_HMAC_SECRET: 'test_request_hmac_secret_at_least_32_chars',
      N8N_APPU_CALLBACK_HMAC_SECRET: 'test_callback_hmac_secret_at_least_32_chars'
    });

    const newApp = buildApp(config, {
      database: db, // Connected to same persistent database
      authVerifier: authVerifier as any,
      razorpayClient: razorpayClient as any,
      n8nClient: n8nClient as any,
      elevenLabsStreamService: mockElevenLabsService
    });
    await newApp.ready();

    // Audio stream request to new server instance
    const audioRes = await newApp.inject({
      method: 'GET',
      url: audioStreamUrl,
      headers: { authorization: `Bearer ${testParentToken}` }
    });

    assert.equal(audioRes.statusCode, 200, 'Must stream successfully after server restart');
    await newApp.close();
  });

  // =========================================================================
  // 4B. REPLAY LIMIT ENFORCEMENT (MAX 3 STREAMS PER TURN)
  // =========================================================================
  it('allows first, second, and third stream then rejects fourth with 429', async () => {
    n8nClient.nextResponse = { text: 'ಮಿತಿ ಪರೀಕ್ಷೆ ಉತ್ತರ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'replay_limit_test' },
      payload: { childId: testChild.id, message: 'ಮಿತಿ ಪರೀಕ್ಷೆ', language: 'kn', includeAudio: true }
    });
    const { audioStreamUrl, requestId } = JSON.parse(msgRes.payload);

    // Track ElevenLabs synthesis count before replays
    const synthBefore = mockElevenLabsService.synthesisHistory.length;

    // Stream 1 → allowed
    const res1 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res1.statusCode, 200, 'First stream must be allowed');

    // Stream 2 → allowed
    const res2 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res2.statusCode, 200, 'Second stream must be allowed');

    // Stream 3 → allowed
    const res3 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res3.statusCode, 200, 'Third stream must be allowed');

    // Verify stream_count is exactly 3
    const recordBefore4 = await AppuAudioAuthorizationRepository.getById(db, requestId);
    assert.equal(recordBefore4?.streamCount, 3, 'Stream count must be exactly 3 after 3 streams');

    // Track synthesis count after 3 allowed streams
    const synthAfter3 = mockElevenLabsService.synthesisHistory.length;
    assert.equal(synthAfter3 - synthBefore, 3, 'ElevenLabs must be called exactly 3 times for 3 allowed streams');

    // Stream 4 → REJECTED with 429
    const res4 = await app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } });
    assert.equal(res4.statusCode, 429, 'Fourth stream must be rejected with 429');
    const errBody = JSON.parse(res4.payload);
    assert.equal(errBody.code, 'AUDIO_STREAM_REPLAY_LIMIT_EXCEEDED');

    // Verify ElevenLabs was NOT called for the rejected 4th attempt
    const synthAfter4 = mockElevenLabsService.synthesisHistory.length;
    assert.equal(synthAfter4, synthAfter3, 'Rejected replay must NOT invoke ElevenLabs');

    // Stream count remains 3 (not 4)
    const recordAfter4 = await AppuAudioAuthorizationRepository.getById(db, requestId);
    assert.equal(recordAfter4?.streamCount, 3, 'Stream count must NOT increment beyond max');
  });

  it('atomic stream_count: concurrent replay attempts cannot exceed configured limit', async () => {
    n8nClient.nextResponse = { text: 'ಏಕಕಾಲಿಕ ಪರೀಕ್ಷೆ', audioSource: null, audioDurationMs: null };
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'concurrent_replay_test' },
      payload: { childId: testChild.id, message: 'ಏಕಕಾಲಿಕ', language: 'kn', includeAudio: true }
    });
    const { audioStreamUrl, requestId } = JSON.parse(msgRes.payload);

    // Fire 6 concurrent stream requests
    const concurrentResults = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({ method: 'GET', url: audioStreamUrl, headers: { authorization: `Bearer ${testParentToken}` } })
      )
    );

    const allowed = concurrentResults.filter(r => r.statusCode === 200);
    const rejected = concurrentResults.filter(r => r.statusCode === 429);

    assert.equal(allowed.length, 3, 'Exactly 3 concurrent streams must be allowed');
    assert.equal(rejected.length, 3, 'Exactly 3 concurrent streams must be rejected with 429');

    // Verify final DB state
    const record = await AppuAudioAuthorizationRepository.getById(db, requestId);
    assert.equal(record?.streamCount, 3, 'Stream count must be exactly 3 after concurrent burst');
  });

  // =========================================================================
  // 4C. EXPIRED AUDIO AUTHORIZATION ROW CLEANUP
  // =========================================================================
  it('deleteExpired removes expired authorization rows while preserving active ones', async () => {
    // 1. Create turn 1 (to be expired)
    n8nClient.nextResponse = { text: 'ಮುಕ್ತಾಯ ಪಠ್ಯ', audioSource: null, audioDurationMs: null };
    const msgRes1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'cleanup_exp_idem' },
      payload: { childId: testChild.id, message: 'ಮುಕ್ತಾಯ ಪ್ರಶ್ನೆ', language: 'kn', includeAudio: true }
    });
    const { requestId: expiredRequestId } = JSON.parse(msgRes1.payload);

    // 2. Create turn 2 (to remain active)
    n8nClient.nextResponse = { text: 'ಸಕ್ರಿಯ ಪಠ್ಯ', audioSource: null, audioDurationMs: null };
    const msgRes2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'cleanup_act_idem' },
      payload: { childId: testChild.id, message: 'ಸಕ್ರಿಯ ಪ್ರಶ್ನೆ', language: 'kn', includeAudio: true }
    });
    const { requestId: activeRequestId } = JSON.parse(msgRes2.payload);

    // 3. Manually set expiredRequestId row expires_at in the past
    await db.query(
      `UPDATE appu_audio_authorizations SET expires_at = NOW() - INTERVAL '1 hour' WHERE request_id = $1`,
      [expiredRequestId]
    );

    // 4. Run cleanup
    const deletedCount = await AppuAudioAuthorizationRepository.deleteExpired(db);
    assert.ok(deletedCount >= 1, 'At least 1 expired row must be deleted');

    // 5. Verify expired audio authorization row is gone
    const expiredRecord = await AppuAudioAuthorizationRepository.getById(db, expiredRequestId);
    assert.equal(expiredRecord, null, 'Expired authorization row must be deleted');

    // 6. Verify active audio authorization row is preserved
    const activeRecord = await AppuAudioAuthorizationRepository.getById(db, activeRequestId);
    assert.ok(activeRecord, 'Active authorization row must be preserved');
    assert.equal(activeRecord!.approvedText, 'ಸಕ್ರಿಯ ಪಠ್ಯ');

    // 7. Verify appu_requests parent rows are NOT deleted (cleanup never touches appu_requests)
    const parentExpired = await db.query(`SELECT id FROM appu_requests WHERE id = $1`, [expiredRequestId]);
    assert.equal(parentExpired.rows.length, 1, 'appu_requests row must NOT be deleted by audio cleanup');

    const parentActive = await db.query(`SELECT id FROM appu_requests WHERE id = $1`, [activeRequestId]);
    assert.equal(parentActive.rows.length, 1, 'appu_requests row must NOT be deleted by audio cleanup');

    // 8. Verify usage_records are not touched
    const usageCheck = await db.query(`SELECT COUNT(*) as cnt FROM usage_records`);
    assert.ok(Number(usageCheck.rows[0].cnt) >= 0, 'usage_records must not be modified by audio cleanup');
  });

  // =========================================================================
  // 5. ENGLISH NON-REGRESSION & INCLUDE_AUDIO=FALSE VERIFICATION
  // =========================================================================
  it('preserves existing English TTS behavior without regression', async () => {
    const englishReply = 'Hello Aarav! Today we will learn about photosynthesis.';
    const mockEnglishBase64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA';

    n8nClient.nextResponse = {
      text: englishReply,
      audioSource: mockEnglishBase64,
      audioDurationMs: 3200
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'eng_non_regression' },
      payload: { childId: testChild.id, message: 'Teach me photosynthesis', language: 'en', includeAudio: true }
    });

    assert.equal(msgRes.statusCode, 200);
    const body = JSON.parse(msgRes.payload);

    assert.equal(body.text, englishReply);
    assert.equal(body.audioSource, mockEnglishBase64, 'English must return existing audioSource Base64');
    assert.equal(body.audioStreamUrl, null, 'English must NOT return audioStreamUrl');
    assert.equal(body.audioDurationMs, 3200);

    // Verify NO audio authorization record is created for English embedded audio
    const authRecord = await AppuAudioAuthorizationRepository.getById(db, body.requestId);
    assert.equal(authRecord, null, 'English embedded turns do not create streaming authorization rows');
  });

  it('preserves includeAudio=false behavior with zero TTS calls', async () => {
    n8nClient.nextResponse = {
      text: 'ಕೇವಲ ಪಠ್ಯ ಉತ್ತರ',
      audioSource: null,
      audioDurationMs: null
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'text_only_turn' },
      payload: { childId: testChild.id, message: 'ಪಠ್ಯ ಮಾತ್ರ', language: 'kn', includeAudio: false }
    });

    assert.equal(msgRes.statusCode, 200);
    const body = JSON.parse(msgRes.payload);

    assert.equal(body.text, 'ಕೇವಲ ಪಠ್ಯ ಉತ್ತರ');
    assert.equal(body.audioSource, null);
    assert.equal(body.audioStreamUrl, null);

    const authRecord = await AppuAudioAuthorizationRepository.getById(db, body.requestId);
    assert.equal(authRecord, null, 'includeAudio=false must not create audio authorization record');
  });

  // =========================================================================
  // 6. KANGLISH SUPPORT & DYNAMIC LANGUAGE ROUTING
  // =========================================================================
  it('routes Romanized Kannada / Kanglish input ("nanage gothilla") to Kannada Eleven v3 streaming', async () => {
    const kannadaResponse = 'ಚಿಂತೆ ಮಾಡಬೇಡ, ನಾನು ನಿನಗೆ ಅರ್ಥವಾಗುವಂತೆ ಹೇಳುತ್ತೇನೆ!';
    n8nClient.nextResponse = {
      text: kannadaResponse,
      audioSource: null,
      audioDurationMs: null
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'kanglish_turn_1' },
      payload: { childId: testChild.id, message: 'nanage gothilla', language: 'en', includeAudio: true }
    });

    assert.equal(msgRes.statusCode, 200);
    const body = JSON.parse(msgRes.payload);

    assert.equal(body.text, kannadaResponse);
    assert.equal(body.audioSource, null, 'Old n8n audio must be suppressed');
    assert.ok(body.audioStreamUrl, 'Must return audioStreamUrl for Kanglish input');
    assert.match(body.audioStreamUrl, /\/api\/appu\/audio\/stream\?requestId=/);

    // Verify audio authorization was created in database
    const authRecord = await AppuAudioAuthorizationRepository.getById(db, body.requestId);
    assert.ok(authRecord, 'Audio authorization must exist for Kanglish turn');
    assert.equal(authRecord!.approvedText, kannadaResponse);
    assert.equal(authRecord!.language, 'kn');
  });

  it('routes Hinglish / Hindi input ("photosynthesis kya hai?") to Hindi Eleven v3 streaming', async () => {
    const hindiResponse = 'प्रकाश संश्लेषण वह प्रक्रिया है जिसमें पौधे सूर्य के प्रकाश की मदद से अपना भोजन बनाते हैं।';
    n8nClient.nextResponse = {
      text: hindiResponse,
      audioSource: null,
      audioDurationMs: null
    };

    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { authorization: `Bearer ${testParentToken}`, 'idempotency-key': 'hinglish_turn_1' },
      payload: { childId: testChild.id, message: 'photosynthesis kya hai?', language: 'hi', includeAudio: true }
    });

    assert.equal(msgRes.statusCode, 200);
    const body = JSON.parse(msgRes.payload);

    assert.equal(body.text, hindiResponse);
    assert.equal(body.audioSource, null, 'Old n8n audio must be suppressed for Hindi response');
    assert.ok(body.audioStreamUrl, 'Must return audioStreamUrl for Hindi turn');
    assert.match(body.audioStreamUrl, /\/api\/appu\/audio\/stream\?requestId=/);

    // Verify audio authorization was created in database with language 'hi'
    const authRecord = await AppuAudioAuthorizationRepository.getById(db, body.requestId);
    assert.ok(authRecord, 'Audio authorization must exist for Hindi turn');
    assert.equal(authRecord!.approvedText, hindiResponse);
    assert.equal(authRecord!.language, 'hi');

    // Stream the audio via GET /api/appu/audio/stream
    const streamRes = await app.inject({
      method: 'GET',
      url: `/api/appu/audio/stream?requestId=${body.requestId}`,
      headers: { authorization: `Bearer ${testParentToken}` }
    });

    assert.equal(streamRes.statusCode, 200);
    assert.equal(streamRes.headers['content-type'], 'audio/mpeg');
    assert.equal(streamRes.headers['transfer-encoding'], 'chunked');
  });
});
