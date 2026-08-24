import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../domain/auth/types.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';
import { EntitlementEnforcementService } from '../domain/entitlements/enforcement-service.js';
import { UsageService } from '../domain/usage/service.js';
import { GuestSessionService } from '../domain/guest/service.js';
import { MentorContextBuilder } from '../domain/personalisation/mentor-context-builder.js';
import type { GuestMentorContext } from '../domain/personalisation/types.js';
import type { N8nClient, N8nMessageEnvelope } from '../domain/gateway/index.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadGatewayError
} from '../errors/index.js';

export interface AppuGatewayRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  n8nClient: N8nClient;
  guestSessionSecret?: string;
}

const authenticatedMessageSchema = z.object({
  childId: z.string().uuid('Invalid childId format. Must be a valid UUID'),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format (e.g. en, kn, hi)')
    .optional()
});

const guestMessageSchema = z.object({
  childId: z.string().uuid('Invalid childId format. Must be a valid UUID').optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format (e.g. en, kn, hi)')
    .optional(),
  guestToken: z.string().optional()
});

/**
 * Extracts and verifies Bearer token if present; returns null if Authorization header is absent.
 */
async function tryResolveAuth(
  request: FastifyRequest,
  authVerifier: AuthVerifier
): Promise<AuthenticatedPrincipal | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new UnauthorizedError('Malformed Authorization header. Expected "Bearer <token>"');
  }

  const token = parts[1];
  return await authVerifier.verifyAccessToken(token);
}

export const appuGatewayRoutes: FastifyPluginAsync<AppuGatewayRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * GET /api/appu/guest-status
   * Returns current complimentary guest quota and signed session token for unauthenticated visitors.
   */
  fastify.get('/api/appu/guest-status', async (request, reply) => {
    const rawGuestToken = (
      request.headers['x-guest-session-token'] ||
      request.headers['x-guest-token'] ||
      (request.query as any)?.guestToken
    ) as string | undefined;

    const clientIp = (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      '127.0.0.1'
    ).trim();

    const status = await GuestSessionService.getGuestStatus(
      opts.db,
      rawGuestToken,
      clientIp,
      GuestSessionService.DEFAULT_MAX_TURNS,
      opts.guestSessionSecret
    );

    reply.header('x-guest-session-token', status.token);
    return reply.status(200).send({
      guestLimit: status.guestLimit,
      limit: status.guestLimit,
      used: status.used,
      remaining: status.remaining,
      loginRequired: status.loginRequired,
      token: status.token,
      guest: {
        limit: status.guestLimit,
        used: status.used,
        remaining: status.remaining,
        token: status.token,
        loginRequired: status.loginRequired
      }
    });
  });

  /**
   * POST /api/appu/message
   * Secure backend gateway routing learner and guest messages to the live n8n AI mentor workflow.
   *
   * Flow:
   * 1. Authenticated User:
   *    - Enforces parent auth, household tenancy, ACTIVE subscription gating,
   *      server-side entitlement limits, AI session reservation, and child personalisation context.
   * 2. Unauthenticated Visitor (Guest):
   *    - Backend-authoritative guest session token resolution & sliding-window IP rate limiting.
   *    - Strictly limits unauthenticated visitors to a MAXIMUM of 3 successful APPU AI turns.
   *    - Rejects turn #4 with HTTP 403 (GUEST_LIMIT_REACHED).
   *    - Failsafe: technical/upstream errors do NOT consume guest turns.
   */
  fastify.post('/api/appu/message', async (request, reply) => {
    const principal = await tryResolveAuth(request, opts.authVerifier);

    // =========================================================================
    // BRANCH 1: AUTHENTICATED USER PATH
    // =========================================================================
    if (principal) {
      const parseResult = authenticatedMessageSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new BadRequestError('Invalid message payload', {
          errors: parseResult.error.flatten().fieldErrors
        });
      }

      const { childId, message, language } = parseResult.data;

      // 1. Resolve and verify parent's household authorization
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      // 2. Verify child profile ownership within this household
      const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
      if (!child) {
        throw new NotFoundError('Child profile not found');
      }

      // 3. Require ACTIVE subscription for paid/entitled AI mentor access
      const subscription = await SubscriptionRepository.getLatestSubscriptionForHousehold(
        opts.db,
        household.id
      );

      if (!subscription || subscription.status !== 'ACTIVE') {
        throw new ForbiddenError(
          'An active subscription is required to access the Appu AI mentor. Please subscribe to a plan.'
        );
      }

      const householdContext = await EntitlementEnforcementService.getHouseholdEntitlements(
        opts.db,
        household.id
      );

      const aiQuotaLimit = Number(householdContext.entitlements?.monthly_ai_sessions ?? 100);
      const voiceQuotaLimitMinutes = Number(householdContext.entitlements?.monthly_voice_minutes ?? 30);
      const voiceQuotaLimitMs = voiceQuotaLimitMinutes * 60 * 1000;

      // Check current voice usage against voice quota
      const currentVoiceUsageMs = await UsageService.getHouseholdVoiceUsageMs(opts.db, household.id);
      const isVoiceQuotaExhausted = currentVoiceUsageMs >= voiceQuotaLimitMs;

      // Extract and validate optional client idempotency key
      const rawIdempotencyKey = (
        request.headers['idempotency-key'] ||
        request.headers['x-idempotency-key'] ||
        (request.body as any)?.idempotencyKey
      );
      const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim().length > 0
        ? rawIdempotencyKey.trim().slice(0, 128)
        : null;

      // Compute deterministic request fingerprint for idempotency binding
      const requestFingerprint = idempotencyKey
        ? crypto.createHash('sha256')
            .update([household.id, child.id, message.trim().toLowerCase(), language || 'en'].join('|'))
            .digest('hex')
        : null;

      // 4. Concurrency-safe atomic AI session quota check & reservation (prior to upstream execution)
      const reservation = await UsageService.reserveAiSession(opts.db, {
        householdId: household.id,
        subscriptionId: subscription.id,
        childId: child.id,
        quotaLimit: aiQuotaLimit,
        idempotencyKey,
        requestFingerprint
      });

      // 5. Build fresh, safe, server-owned MentorContext from authoritative storage
      const mentorContext = await MentorContextBuilder.buildMentorContext(
        opts.db,
        household.id,
        child.id,
        householdContext.entitlements
      );

      // 6. Construct structured server-generated envelope for n8n
      const envelope: N8nMessageEnvelope = {
        action: 'sendMessage',
        channel: 'website',
        sessionId: `appu_child_${child.id}`,
        chatInput: message,
        message,
        language: language || mentorContext.primaryLanguage,
        childId: child.id,
        mentorContext
      };

      // 7. Forward to n8n via secure client with reservation rollback on failure
      let response: any;
      try {
        response = await opts.n8nClient.sendMessage(envelope);
      } catch (error: any) {
        // Release new reservation on failure so the household is not charged for failed responses
        if (!reservation.isExisting) {
          await UsageService.releaseAiSession(opts.db, household.id, reservation.reservationId).catch(() => {});
        }
        if (error?.name === 'AppError' || error?.statusCode) {
          throw error;
        }
        throw new BadGatewayError('Could not reach AI mentor service. Please try again later.');
      }

      // 8. Commit usage reservation after successful upstream response
      if (!reservation.isExisting) {
        await UsageService.commitAiSession(opts.db, household.id, reservation.reservationId);
      }

      // 9. Strict Voice Quota Enforcement & Atomic Voice Duration Recording
      let finalAudioSource: string | null = null;
      let finalAudioDurationMs: number | null = null;

      if (!isVoiceQuotaExhausted && response.audioSource) {
        const candidateDurationMs = response.audioDurationMs ?? null;

        if (candidateDurationMs && candidateDurationMs > 0) {
          const voiceResult = await UsageService.recordVoiceUsageAtomic(opts.db, {
            householdId: household.id,
            subscriptionId: subscription.id,
            childId: child.id,
            durationMs: candidateDurationMs,
            quotaLimitMs: voiceQuotaLimitMs,
            idempotencyKey: idempotencyKey ? `voice_${idempotencyKey}` : null,
            requestFingerprint
          });

          if (voiceResult.delivered) {
            finalAudioSource = response.audioSource;
            finalAudioDurationMs = candidateDurationMs;
          } else {
            finalAudioSource = null;
            finalAudioDurationMs = null;
            request.log.info({
              householdId: household.id,
              durationMs: candidateDurationMs,
              remainingMs: voiceResult.remainingMs
            }, 'Generated audio exceeds remaining voice allowance; delivering text only.');
          }
        }
      }

      return reply.status(200).send({
        childId: child.id,
        text: response.text,
        audioSource: finalAudioSource,
        audioDurationMs: finalAudioDurationMs,
        guestSession: null
      });
    }

    // =========================================================================
    // BRANCH 2: UNAUTHENTICATED GUEST PATH (MAXIMUM 3 TURNS)
    // =========================================================================
    const parseResult = guestMessageSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid message payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { message, language, guestToken } = parseResult.data;

    const rawGuestToken = (
      request.headers['x-guest-session-token'] ||
      request.headers['x-guest-token'] ||
      guestToken
    ) as string | undefined;

    const clientIp = (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      request.ip ||
      '127.0.0.1'
    ).trim();

    const ipHash = GuestSessionService.computeIpHash(clientIp);

    // 1. Sliding window IP rate limit check
    GuestSessionService.checkIpRateLimit(ipHash);

    // 2. Resolve guest session authoritatively from signed token or database/store
    const { session } = await GuestSessionService.resolveGuestSession(
      opts.db,
      rawGuestToken,
      clientIp,
      opts.guestSessionSecret
    );

    // 3. Atomically reserve 1 guest turn before upstream execution (throws 403 if turns >= 3)
    const reservation = await GuestSessionService.reserveGuestTurn(
      opts.db,
      session,
      GuestSessionService.DEFAULT_MAX_TURNS
    );

    // 4. Construct safe server-generated guest envelope for n8n
    const mentorContext: GuestMentorContext = {
      mode: 'guest',
      primaryLanguage: language || 'en',
      personalizationEnabled: false
    };

    const envelope: N8nMessageEnvelope = {
      action: 'sendMessage',
      channel: 'website',
      sessionId: `appu_guest_${session.id}`,
      chatInput: message,
      message,
      language: language || 'en',
      mentorContext
    };

    // 5. Forward to n8n AI workflow with failsafe rollback on error
    let response: any;
    try {
      response = await opts.n8nClient.sendMessage(envelope);
    } catch (error: any) {
      // NOTE: On technical or upstream failure, release reserved turn so user is not penalized!
      await GuestSessionService.releaseGuestTurn(opts.db, session.id).catch(() => {});
      if (error?.name === 'AppError' || error?.statusCode) {
        throw error;
      }
      throw new BadGatewayError('Could not reach AI mentor service. Please try again later.');
    }

    // 6. Generate signed token reflecting the successfully completed turn count
    const guestTokenResult = GuestSessionService.signGuestToken({
      id: session.id,
      turns: reservation.used,
      exp: session.expiresAt.getTime(),
      ipHash: session.ipHash
    }, opts.guestSessionSecret);

    // 7. Deliver response with updated guest session metadata and signed token
    reply.header('x-guest-session-token', guestTokenResult);
    return reply.status(200).send({
      text: response.text,
      audioSource: response.audioSource || null,
      audioDurationMs: response.audioDurationMs || null,
      guest: {
        token: guestTokenResult,
        limit: GuestSessionService.DEFAULT_MAX_TURNS,
        used: reservation.used,
        remaining: reservation.remaining,
        loginRequired: reservation.remaining === 0
      },
      guestSession: {
        token: guestTokenResult,
        guestLimit: GuestSessionService.DEFAULT_MAX_TURNS,
        used: reservation.used,
        remaining: reservation.remaining,
        loginRequired: reservation.remaining === 0
      }
    });
  });
};
