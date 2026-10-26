import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import { appuVoiceLineRoutes } from '../src/routes/appu-voice-lines.js';
import { GAME_LINES } from '../src/domain/voice/game-lines.js';

function buildTestApp(synthesize: (text: string) => Promise<{ stream: Readable }>) {
  const app = Fastify();
  app.register(appuVoiceLineRoutes, { synthesize });
  return app;
}

describe('GET /api/appu/voice-line/:key', () => {
  it('voices a whitelisted line once and serves it from cache after that', async () => {
    const spoken: string[] = [];
    const app = buildTestApp(async (text) => {
      spoken.push(text);
      return { stream: Readable.from([Buffer.from('mp3-bytes')]) };
    });
    const first = await app.inject({ method: 'GET', url: '/api/appu/voice-line/lose?lang=en' });
    const second = await app.inject({ method: 'GET', url: '/api/appu/voice-line/lose?lang=en' });
    assert.equal(first.statusCode, 200);
    assert.equal(first.headers['content-type'], 'audio/mpeg');
    assert.equal(first.body, 'mp3-bytes');
    assert.equal(second.body, 'mp3-bytes');
    assert.deepEqual(spoken, [GAME_LINES.lose.en]);
    await app.close();
  });

  it('uses the requested language and falls back to English for unknown languages', async () => {
    const spoken: string[] = [];
    const app = buildTestApp(async (text) => {
      spoken.push(text);
      return { stream: Readable.from([Buffer.from('x')]) };
    });
    await app.inject({ method: 'GET', url: '/api/appu/voice-line/win?lang=kn' });
    await app.inject({ method: 'GET', url: '/api/appu/voice-line/win?lang=fr' });
    assert.deepEqual(spoken, [GAME_LINES.win.kn, GAME_LINES.win.en]);
    await app.close();
  });

  it('rejects lines that are not whitelisted', async () => {
    let called = false;
    const app = buildTestApp(async () => { called = true; return { stream: Readable.from([]) }; });
    const res = await app.inject({ method: 'GET', url: '/api/appu/voice-line/anything-else' });
    assert.equal(res.statusCode, 404);
    assert.equal(called, false);
    await app.close();
  });

  it('returns 503 when the voice provider fails and retries on the next request', async () => {
    let calls = 0;
    const app = buildTestApp(async () => {
      calls += 1;
      if (calls === 1) throw new Error('provider down');
      return { stream: Readable.from([Buffer.from('ok')]) };
    });
    const failed = await app.inject({ method: 'GET', url: '/api/appu/voice-line/offer' });
    const retried = await app.inject({ method: 'GET', url: '/api/appu/voice-line/offer' });
    assert.equal(failed.statusCode, 503);
    assert.equal(retried.statusCode, 200);
    assert.equal(retried.body, 'ok');
    await app.close();
  });
});
