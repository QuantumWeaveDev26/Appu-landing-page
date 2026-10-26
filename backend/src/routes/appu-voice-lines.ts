import type { FastifyPluginAsync } from 'fastify';
import type { Readable } from 'node:stream';
import { resolveGameLine } from '../domain/voice/game-lines.js';

export interface AppuVoiceLineRouteOptions {
  /** Produces Appu's voice (MP3) for a fixed line; wired to ElevenLabs in app.ts. */
  synthesize: (text: string) => Promise<{ stream: Readable }>;
}

/**
 * GET /api/appu/voice-line/:key?lang=en|kn|hi
 * Appu's real voice for the fixed mini-game lines (QA-safe: whitelisted text only).
 * Each line is generated once per server and then served from memory.
 */
export const appuVoiceLineRoutes: FastifyPluginAsync<AppuVoiceLineRouteOptions> = async (fastify, opts) => {
  const cache = new Map<string, Buffer>();
  const inFlight = new Map<string, Promise<Buffer>>();

  const toBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  };

  fastify.get<{ Params: { key: string }; Querystring: { lang?: string } }>('/api/appu/voice-line/:key', async (request, reply) => {
    const lang = ['en', 'kn', 'hi'].includes(String(request.query.lang)) ? String(request.query.lang) : 'en';
    const text = resolveGameLine(request.params.key, lang);
    if (!text) return reply.status(404).send({ error: 'unknown_line' });

    const cacheKey = `${request.params.key}:${lang}`;
    let audio = cache.get(cacheKey);
    if (!audio) {
      let pending = inFlight.get(cacheKey);
      if (!pending) {
        pending = opts.synthesize(text).then(({ stream }) => toBuffer(stream));
        inFlight.set(cacheKey, pending);
      }
      try {
        audio = await pending;
        cache.set(cacheKey, audio);
      } catch (err) {
        request.log.warn({ err, line: cacheKey }, 'Voice line generation failed');
        return reply.status(503).send({ error: 'voice_unavailable' });
      } finally {
        inFlight.delete(cacheKey);
      }
    }

    return reply
      .header('Content-Type', 'audio/mpeg')
      .header('Cache-Control', 'public, max-age=86400')
      .send(audio);
  });
};
