import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { newDb } from 'pg-mem';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import { runMigrations } from '../src/db/migrator.js';
import type { Queryable, TransactionalQueryable } from '../src/db/types.js';
import { MockAuthVerifier } from '../src/domain/auth/mock-verifier.js';
import { MockN8nClient } from '../src/domain/gateway/mock-client.js';
import { GuestSessionService } from '../src/domain/guest/service.js';

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
    implementation: (text: string) => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
      }
      return hash;
    }
  });

  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const db: TransactionalQueryable = {
    async query<T = any>(sql: string, params: any[] = []) {
      const res = await pool.query<T>(sql, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount
      };
    },

    async transaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const transactionDb: Queryable = {
        async query<TResult = any>(queryText: string, values: any[] = []) {
          const result = await client.query<TResult>(queryText, values);
          return {
            rows: result.rows as TResult[],
            rowCount: result.rowCount
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

describe('APPU Guest Access Control & 3-Turn Authoritative Quota', () => {
  let db: TransactionalQueryable;
  let authVerifier: MockAuthVerifier;
  let mockN8nClient: MockN8nClient;
  let app: any;

  beforeEach(async () => {
    GuestSessionService.resetMemoryStore();
    db = createTestDatabase();
    await runMigrations(db);

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key'
    });

    authVerifier = new MockAuthVerifier();
    mockN8nClient = new MockN8nClient({
      defaultResponse: {
        text: 'Hello from APPU AI Mentor!',
        audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAA='
      }
    });

    app = buildApp(config, {
      database: db,
      authVerifier,
      n8nClient: mockN8nClient
    });
  });

  it('1. Guest turn 1 succeeds and returns remaining = 2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        message: 'What is photosynthesis?'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);

    assert.equal(body.text, 'Hello from mock Appu!');
    assert.ok(body.audioSource);
    assert.ok(body.guestSession);
    assert.equal(body.guestSession.used, 1);
    assert.equal(body.guestSession.remaining, 2);
    assert.equal(body.guestSession.guestLimit, 3);
    assert.equal(body.guestSession.loginRequired, false);
    assert.ok(body.guestSession.token);
  });

  it('2. Guest turn 2 succeeds and returns remaining = 1', async () => {
    // Turn 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Question 1' }
    });
    assert.equal(res1.statusCode, 200);
    const token1 = JSON.parse(res1.body).guestSession.token;

    // Turn 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'x-guest-session-token': token1
      },
      payload: { message: 'Question 2' }
    });

    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.guestSession.used, 2);
    assert.equal(body2.guestSession.remaining, 1);
  });

  it('3. Guest turn 3 succeeds and returns remaining = 0', async () => {
    // Turn 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Question 1' }
    });
    const token1 = JSON.parse(res1.body).guestSession.token;

    // Turn 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-guest-session-token': token1 },
      payload: { message: 'Question 2' }
    });
    const token2 = JSON.parse(res2.body).guestSession.token;

    // Turn 3
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-guest-session-token': token2 },
      payload: { message: 'Question 3' }
    });

    assert.equal(res3.statusCode, 200);
    const body3 = JSON.parse(res3.body);
    assert.equal(body3.guestSession.used, 3);
    assert.equal(body3.guestSession.remaining, 0);
    assert.equal(body3.guestSession.loginRequired, true);
  });

  it('4. Guest turn 4 is rejected with 403 GUEST_LIMIT_REACHED', async () => {
    let token = '';

    // Turns 1, 2, 3
    for (let i = 1; i <= 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: token ? { 'x-guest-session-token': token } : {},
        payload: { message: `Question ${i}` }
      });
      assert.equal(res.statusCode, 200);
      token = JSON.parse(res.body).guestSession.token;
    }

    // Turn 4 with token
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-guest-session-token': token },
      payload: { message: 'Question 4' }
    });

    assert.equal(res4.statusCode, 403);
    const body4 = JSON.parse(res4.body);
    assert.equal(body4.code, 'GUEST_LIMIT_REACHED');
    assert.equal(body4.loginRequired, true);
    assert.equal(body4.used, 3);
    assert.equal(body4.guestLimit, 3);
  });

  it('5. Direct API call bypassing frontend cannot exceed quota', async () => {
    const fakeToken = GuestSessionService.signGuestToken({
      id: 'gst_fake_attacker',
      turns: 3
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        'x-guest-session-token': fakeToken
      },
      payload: { message: 'Attempt to bypass' }
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'GUEST_LIMIT_REACHED');
  });

  it('6. Voice interaction consumes exactly 1 guest turn', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Spoken question through mic' }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.audioSource);
    assert.equal(body.guestSession.used, 1);
  });

  it('7. Failed upstream AI request does NOT consume a guest turn', async () => {
    mockN8nClient.sendMessage = async () => {
      throw new Error('N8N upstream network error');
    };

    // Failed attempt
    const resFail = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Will fail' }
    });

    assert.equal(resFail.statusCode, 502);

    // Subsequent successful attempt should start at turn 1 (used = 1, remaining = 2)
    mockN8nClient.sendMessage = async () => ({
      text: 'Recovered response',
      audioSource: null
    });

    const resSuccess = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Will succeed' }
    });

    assert.equal(resSuccess.statusCode, 200);
    const body = JSON.parse(resSuccess.body);
    assert.equal(body.guestSession.used, 1);
    assert.equal(body.guestSession.remaining, 2);
  });

  it('8. GET /api/appu/guest-status returns accurate live quota', async () => {
    // Initial status
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/appu/guest-status'
    });
    assert.equal(res1.statusCode, 200);
    const status1 = JSON.parse(res1.body);
    assert.equal(status1.guestLimit, 3);
    assert.equal(status1.used, 0);
    assert.equal(status1.remaining, 3);
    assert.equal(status1.loginRequired, false);
    assert.ok(status1.token);

    // Consume 1 turn
    const resMsg = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-guest-session-token': status1.token },
      payload: { message: 'Test question' }
    });
    const tokenAfterMsg = JSON.parse(resMsg.body).guestSession.token;

    // Check status again
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/appu/guest-status',
      headers: { 'x-guest-session-token': tokenAfterMsg }
    });
    assert.equal(res2.statusCode, 200);
    const status2 = JSON.parse(res2.body);
    assert.equal(status2.used, 1);
    assert.equal(status2.remaining, 2);
  });

  it('9. Guest A and Guest B have isolated session counters', async () => {
    // Guest A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-forwarded-for': '192.168.1.1' },
      payload: { message: 'Guest A query' }
    });
    const bodyA = JSON.parse(resA.body);

    // Guest B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-forwarded-for': '192.168.1.2' },
      payload: { message: 'Guest B query' }
    });
    const bodyB = JSON.parse(resB.body);

    assert.notEqual(bodyA.guestSession.token, bodyB.guestSession.token);
    assert.equal(bodyA.guestSession.used, 1);
    assert.equal(bodyB.guestSession.used, 1);
  });

  it('10. CONCURRENCY: 5 simultaneous requests for a session with used_turns = 2 results in exactly 1 success (used = 3) and 4 rejections', async () => {
    // Prime the session to used_turns = 2
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      payload: { message: 'Prime question 1' }
    });
    const token1 = JSON.parse(res1.body).guestSession.token;

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: { 'x-guest-session-token': token1 },
      payload: { message: 'Prime question 2' }
    });
    const token2 = JSON.parse(res2.body).guestSession.token;
    assert.equal(JSON.parse(res2.body).guestSession.used, 2);

    // Add a 50ms delay to mock n8n to ensure true concurrent in-flight overlap
    mockN8nClient.sendMessage = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return {
        text: 'Concurrent reply',
        audioSource: null
      };
    };

    // Fire 5 simultaneous requests with token2 (used = 2)
    const promises = Array.from({ length: 5 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/appu/message',
        headers: { 'x-guest-session-token': token2 },
        payload: { message: `Simultaneous question ${i}` }
      })
    );

    const results = await Promise.all(promises);
    const successResponses = results.filter((r: any) => r.statusCode === 200);
    const rejectedResponses = results.filter((r: any) => r.statusCode === 403);

    assert.equal(successResponses.length, 1, 'Exactly 1 concurrent request must succeed');
    assert.equal(rejectedResponses.length, 4, 'Remaining 4 concurrent requests must be rejected with 403');

    for (const r of rejectedResponses) {
      const b = JSON.parse(r.body);
      assert.equal(b.code, 'GUEST_LIMIT_REACHED');
    }

    // Verify status shows exactly 3 used turns (never 4+)
    const finalStatus = await app.inject({
      method: 'GET',
      url: '/api/appu/guest-status',
      headers: { 'x-guest-session-token': token2 }
    });
    assert.equal(JSON.parse(finalStatus.body).used, 3);
    assert.equal(JSON.parse(finalStatus.body).remaining, 0);
  });

  it('11. AUTHENTICATED USER ISOLATION: Invalid or expired Bearer token throws 401 (never falls back to guest mode)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/appu/message',
      headers: {
        authorization: 'Bearer invalid_tampered_parent_token'
      },
      payload: {
        message: 'Should be rejected with 401'
      }
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error.code, 'unauthorized');
  });

  it('12. TOKEN SECURITY: Tampered/forged token signature is rejected and client is allocated a new session', async () => {
    const validToken = GuestSessionService.signGuestToken({
      id: 'gst_legitimate_session',
      turns: 2,
      exp: Date.now() + 3600000
    });

    // Tamper with payload (e.g. attempting to forge turns back to 0)
    const [payloadB64, sig] = validToken.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({
      id: 'gst_legitimate_session',
      turns: 0,
      iat: Date.now(),
      exp: Date.now() + 3600000,
      ipHash: 'fake_ip_hash'
    })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const forgedToken = `${forgedPayload}.${sig}`;

    // Verify token decoder rejects forged token
    const decoded = GuestSessionService.verifyGuestToken(forgedToken);
    assert.equal(decoded, null, 'Forged token must return null from verifyGuestToken');

    // Gateway handles forged token safely by allocating a new guest session instead of trusting the forged payload
    const res = await app.inject({
      method: 'GET',
      url: '/api/appu/guest-status',
      headers: { 'x-guest-session-token': forgedToken }
    });
    assert.equal(res.statusCode, 200);
    const status = JSON.parse(res.body);
    assert.notEqual(status.token, forgedToken, 'Must generate a new valid token');
  });

  it('13. TOKEN SECURITY: Expired token is rejected server-side', () => {
    const expiredToken = GuestSessionService.signGuestToken({
      id: 'gst_expired_session',
      turns: 1,
      exp: Date.now() - 1000 // Expired 1 second ago
    });

    const decoded = GuestSessionService.verifyGuestToken(expiredToken);
    assert.equal(decoded, null, 'Expired token must return null');
  });

  it('14. TOKEN SECURITY: Token signed with unauthorized secret is rejected', () => {
    const attackerSecret = 'attacker_malicious_secret_key_99999';
    const attackerToken = GuestSessionService.signGuestToken({
      id: 'gst_attacker_session',
      turns: 0,
      exp: Date.now() + 3600000
    }, attackerSecret);

    const decoded = GuestSessionService.verifyGuestToken(attackerToken);
    assert.equal(decoded, null, 'Token signed with foreign secret must be rejected');
  });

  it('15. PRODUCTION ENFORCEMENT: GuestSessionService throws in production when secret is absent', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.GUEST_SESSION_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.GUEST_SESSION_SECRET;

      assert.throws(
        () => GuestSessionService.getSecret(),
        /GUEST_SESSION_SECRET is required in production/
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalSecret) {
        process.env.GUEST_SESSION_SECRET = originalSecret;
      }
    }
  });
});

