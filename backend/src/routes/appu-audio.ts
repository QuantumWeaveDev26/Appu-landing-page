import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { AppuAudioAuthorizationRepository } from '../domain/voice/repository.js';
import { ElevenLabsStreamService } from '../domain/voice/service.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadGatewayError
} from '../errors/index.js';

export interface AppuAudioRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  elevenLabsStreamService: ElevenLabsStreamService;
}

const audioStreamQuerySchema = z.object({
  requestId: z.string().uuid('Invalid requestId format. Must be a valid UUID')
});

export const appuAudioRoutes: FastifyPluginAsync<AppuAudioRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * GET /api/appu/audio/stream
   * 
   * Streams server-authorized Eleven v3 Kannada audio chunks for an authenticated request.
   * 
   * Security & Anti-Abuse Invariants:
   * 1. Requires valid Bearer authorization token from authenticated parent/learner.
   * 2. Scoped strictly to the authenticated user's household.
   * 3. Requires an existing durable server-authorized record in appu_audio_authorizations.
   * 4. Synthesizes ONLY the exact server-approved response text (arbitrary client text is rejected).
   * 5. Enforces short-lived authorization expiry (10 minutes).
   * 6. Streams binary audio/mpeg chunks incrementally without server-side memory accumulation.
   */
  fastify.get('/api/appu/audio/stream', async (request, reply) => {
    // 1. Validate query parameters
    const parseResult = audioStreamQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid audio stream request parameters', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }
    const { requestId } = parseResult.data;

    // 2. Authenticate requesting principal via Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required: Bearer token missing');
    }
    const token = authHeader.slice(7).trim();
    const principal = await opts.authVerifier.verifyAccessToken(token);
    if (!principal) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    // 3. Verify household tenancy and authorization
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 4. Retrieve durable authorization record and check expiry & ownership
    const { record, isExpired, isWrongHousehold } =
      await AppuAudioAuthorizationRepository.findValidByHouseholdAndRequestId(
        opts.db,
        household.id,
        requestId
      );

    if (isWrongHousehold) {
      throw new ForbiddenError('Unauthorized access to audio stream for this request');
    }

    if (isExpired) {
      return reply.status(410).send({
        code: 'AUDIO_STREAM_EXPIRED',
        error: 'Audio stream authorization has expired. Please ask your question again.'
      });
    }

    if (!record) {
      throw new NotFoundError('Audio stream authorization record not found for this requestId');
    }

    // 5. Update status to STREAMING and enforce atomic replay limit (max 3 streams per turn)
    const streamStartResult = await AppuAudioAuthorizationRepository.recordStreamStart(
      opts.db,
      requestId,
      3
    );

    if (!streamStartResult.allowed) {
      return reply.status(429).send({
        code: 'AUDIO_STREAM_REPLAY_LIMIT_EXCEEDED',
        error: 'Audio stream playback limit reached for this message turn. Please submit a new query for fresh audio.'
      });
    }

    // 6. Connect to ElevenLabs HTTP Chunked Stream and pipe directly to client
    try {
      const { stream, contentType, modelId } = await opts.elevenLabsStreamService.getAudioStream(
        record.approvedText
      );

      const origin = request.headers.origin;
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Appu-Voice-Model': modelId,
        'X-Appu-Request-Id': requestId
      };

      if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Vary'] = 'Origin';
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      reply.raw.writeHead(200, headers);

      stream.pipe(reply.raw);

      stream.on('end', () => {
        AppuAudioAuthorizationRepository.recordStreamComplete(opts.db, requestId).catch(() => {});
      });

      stream.on('error', (streamErr) => {
        request.log.error({ err: streamErr, requestId }, 'Audio stream piping error');
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(502, { 'Content-Type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'Upstream audio streaming interrupted' }));
        }
      });
    } catch (err: any) {
      request.log.error({ err, requestId }, 'Failed to initiate ElevenLabs audio stream');
      throw new BadGatewayError('Failed to initiate audio stream from upstream voice provider');
    }
  });
};
