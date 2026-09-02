import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { GuestSessionService } from '../domain/guest/service.js';
import { AppuAudioAuthorizationRepository } from '../domain/voice/repository.js';
import { ElevenLabsStreamService } from '../domain/voice/service.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';
import { UsageService } from '../domain/usage/service.js';
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
  guestSessionSecret?: string;
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
   * Streams server-authorized Eleven v3 regional audio chunks for an authenticated or guest request.
   * 
   * Security & Anti-Abuse Invariants:
   * 1. Requires valid Bearer token (authenticated) OR X-Guest-Session-Token (guest).
   * 2. Scoped strictly to the authenticated user's household OR the guest session.
   * 3. Requires an existing durable server-authorized record in appu_audio_authorizations.
   * 4. Synthesizes ONLY the exact server-approved response text (arbitrary client text is rejected).
   * 5. Enforces short-lived authorization expiry (10 minutes).
   * 6. Streams binary audio/mpeg chunks incrementally without server-side memory accumulation.
   * 7. Cross-principal isolation: guest cannot stream household audio; household cannot stream guest audio.
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

    // 2. Determine authentication mode: Bearer (household) or X-Guest-Session-Token (guest)
    const authHeader = request.headers.authorization;
    const guestToken = request.headers['x-guest-session-token'] as string | undefined;

    let record: any = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // ===== AUTHENTICATED HOUSEHOLD PATH =====
      const token = authHeader.slice(7).trim();
      const principal = await opts.authVerifier.verifyAccessToken(token);
      if (!principal) {
        throw new UnauthorizedError('Invalid or expired authentication token');
      }

      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      const result = await AppuAudioAuthorizationRepository.findValidByHouseholdAndRequestId(
        opts.db,
        household.id,
        requestId
      );

      if (result.isWrongHousehold) {
        throw new ForbiddenError('Unauthorized access to audio stream for this request');
      }
      if (result.isExpired) {
        return reply.status(410).send({
          code: 'AUDIO_STREAM_EXPIRED',
          error: 'Audio stream authorization has expired. Please ask your question again.'
        });
      }
      if (!result.record) {
        throw new NotFoundError('Audio stream authorization record not found for this requestId');
      }

      record = result.record;

    } else if (guestToken && typeof guestToken === 'string' && guestToken.trim()) {
      // ===== GUEST SESSION PATH =====
      const decoded = GuestSessionService.verifyGuestToken(guestToken.trim(), opts.guestSessionSecret);
      if (!decoded || !decoded.id) {
        throw new UnauthorizedError('Invalid or expired guest session token');
      }

      const result = await AppuAudioAuthorizationRepository.findValidByGuestAndRequestId(
        opts.db,
        decoded.id,
        requestId
      );

      if (result.isWrongGuest) {
        throw new ForbiddenError('Unauthorized access to audio stream for this request');
      }
      if (result.isExpired) {
        return reply.status(410).send({
          code: 'AUDIO_STREAM_EXPIRED',
          error: 'Audio stream authorization has expired. Please ask your question again.'
        });
      }
      if (!result.record) {
        throw new NotFoundError('Audio stream authorization record not found for this requestId');
      }

      record = result.record;

    } else {
      throw new UnauthorizedError('Authentication required: Bearer token or X-Guest-Session-Token missing');
    }

    // 3. Enforce atomic replay limit (max 3 streams per turn)
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

    // 3b. Voice-minute quota pre-check (household-authenticated requests only -- guests are
    // limited by turn count, not voice minutes, unchanged). Blocks BEFORE spending any
    // ElevenLabs generation cost if the household is already over its monthly allowance.
    let voiceQuotaLimitMs = 0;
    let subscriptionId: string | null = null;
    if (record.householdId) {
      const [subscriptionContext, currentVoiceUsageMs] = await Promise.all([
        SubscriptionRepository.getLatestSubscriptionWithEntitlementsForHousehold(opts.db, record.householdId),
        UsageService.getHouseholdVoiceUsageMs(opts.db, record.householdId)
      ]);
      if (subscriptionContext) {
        subscriptionId = subscriptionContext.subscription.id;
        const voiceQuotaLimitMinutes = Number(subscriptionContext.entitlements?.monthly_voice_minutes ?? 30);
        voiceQuotaLimitMs = voiceQuotaLimitMinutes * 60 * 1000;
        if (currentVoiceUsageMs >= voiceQuotaLimitMs) {
          return reply.status(403).send({
            code: 'VOICE_QUOTA_EXHAUSTED',
            error: 'Monthly voice minutes exhausted. Text responses remain available.'
          });
        }
      }
    }

    // 4. Connect to ElevenLabs HTTP Chunked Stream and pipe directly to client
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

      // Byte-count-only duration estimate for usage accounting -- chunks are counted as they
      // pass through, never retained, preserving the no-server-side-accumulation streaming
      // invariant. Assumes the constant-bitrate mp3_44100_128 output_format pinned in
      // ElevenLabsStreamService (128 kbps = 16 bytes/ms).
      let totalBytes = 0;
      if (record.householdId && subscriptionId) {
        stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
        });
      }

      stream.on('end', () => {
        AppuAudioAuthorizationRepository.recordStreamComplete(opts.db, requestId).catch(() => {});

        if (record.householdId && subscriptionId && totalBytes > 0) {
          const durationMs = Math.round(totalBytes / 16);
          UsageService.recordVoiceUsageAtomic(opts.db, {
            householdId: record.householdId,
            subscriptionId,
            childId: record.childId,
            durationMs,
            quotaLimitMs: voiceQuotaLimitMs,
            idempotencyKey: `voice_stream_${requestId}`
          }).catch((err) => {
            request.log.warn({ err, requestId }, 'Failed to record streamed voice usage');
          });
        }
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
