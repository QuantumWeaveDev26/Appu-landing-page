import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../domain/auth/types.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';
import { ensureBetaSubscription } from '../domain/subscription/beta-service.js';
import { EntitlementEnforcementService } from '../domain/entitlements/enforcement-service.js';
import { UsageService } from '../domain/usage/service.js';
import { GuestSessionService } from '../domain/guest/service.js';
import { MentorContextBuilder } from '../domain/personalisation/mentor-context-builder.js';
import { PersonalisationRepository } from '../domain/personalisation/repository.js';
import type { GuestMentorContext } from '../domain/personalisation/types.js';
import type { N8nClient, N8nMessageEnvelope } from '../domain/gateway/index.js';
import { AppuRequestRepository, AppuRequestService, AppuRequestStates } from '../domain/appu-request/index.js';
import { AppuAudioAuthorizationRepository } from '../domain/voice/index.js';
import { detectLanguageIntent } from '../domain/language/index.js';
import { ConversationRepository, ConversationService } from '../domain/conversation/index.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadGatewayError,
  ErrorCodes
} from '../errors/index.js';

function isKannadaResponseText(text: string): boolean {
  return /[\u0C80-\u0CFF]/.test(text || '');
}

function isHindiResponseText(text: string): boolean {
  return /[\u0900-\u097F]/.test(text || '');
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MiB decoded ceiling
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/]+=*)$/i;

function parseImageDataUrl(raw: string): { mimeType: string; base64: string } | null {
  const match = raw.match(IMAGE_DATA_URL_PATTERN);
  if (!match) return null;
  const base64 = match[2];
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes === 0 || approxBytes > MAX_IMAGE_BYTES) return null;
  return { mimeType: match[1].toLowerCase(), base64 };
}

export interface AppuGatewayRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  n8nClient: N8nClient;
  guestSessionSecret?: string;
  betaMode?: boolean;
  betaChatLimit?: number;
}

const authenticatedMessageSchema = z.object({
  childId: z.string().uuid('Invalid childId format. Must be a valid UUID'),
  conversationId: z.string().uuid().optional(),
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
  includeAudio: z.boolean().optional(),
  imageBase64: z.string().trim().max(6_000_000, 'Image payload too large').optional()
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
  guestToken: z.string().optional(),
  includeAudio: z.boolean().optional(),
  imageBase64: z.string().trim().max(6_000_000, 'Image payload too large').optional()
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
  fastify.post('/api/appu/message', { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const tReqStart = performance.now();
    const principal = await tryResolveAuth(request, opts.authVerifier);
    const tAuthEnd = performance.now();

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

      const { childId, conversationId, message, language, includeAudio, imageBase64 } = parseResult.data;

      let imagePayload: { mimeType: string; base64: string } | null = null;
      if (imageBase64) {
        imagePayload = parseImageDataUrl(imageBase64);
        if (!imagePayload) {
          throw new BadRequestError('Invalid image attachment. Must be a PNG, JPEG, or WEBP image under 4MB.', {
            errors: { imageBase64: ['Invalid or oversized image data'] }
          });
        }
      }

      // 1. Resolve and verify parent's household authorization (Single query)
      const tHouseholdStart = performance.now();
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );
      const tHouseholdEnd = performance.now();

      // 2. Parallelize independent pre-n8n domain reads in ONE round-trip batch
      // (child profile verification, subscription with validated entitlements, voice usage, personalisation)
      const tContextStart = performance.now();
      const [
        child,
        initialSubscriptionContext,
        currentVoiceUsageMs,
        personalisation
      ] = await Promise.all([
        TenancyRepository.getChildProfile(opts.db, household.id, childId),
        SubscriptionRepository.getLatestSubscriptionWithEntitlementsForHousehold(opts.db, household.id),
        UsageService.getHouseholdVoiceUsageMs(opts.db, household.id),
        PersonalisationRepository.getPersonalisation(opts.db, household.id, childId)
      ]);
      const tContextEnd = performance.now();

      if (!child) {
        throw new NotFoundError('Child profile not found');
      }

      let subscriptionContext = initialSubscriptionContext;

      // BETA: lazily provision a free beta subscription instead of requiring Razorpay checkout.
      // Reversible -- stops firing as soon as APPU_BETA_MODE is turned off.
      if (opts.betaMode && (!subscriptionContext || subscriptionContext.subscription.status !== 'ACTIVE')) {
        await ensureBetaSubscription(opts.db, household.id, opts.betaChatLimit ?? 30);
        subscriptionContext = await SubscriptionRepository.getLatestSubscriptionWithEntitlementsForHousehold(
          opts.db,
          household.id
        );
      }

      if (!subscriptionContext || subscriptionContext.subscription.status !== 'ACTIVE') {
        throw new ForbiddenError(
          'An active subscription is required to access the Appu AI mentor. Please subscribe to a plan.'
        );
      }

      const { subscription, entitlements } = subscriptionContext;

      let conversation;
      if (conversationId) {
        conversation = await ConversationRepository.getOwned(opts.db, household.id, child.id, conversationId);
        if (!conversation) throw new NotFoundError('Conversation not found');
      } else {
        conversation = await ConversationService.resolveOwnedOrLatest(opts.db, household.id, child.id);
      }

      const aiQuotaLimit = Number(entitlements?.monthly_ai_sessions ?? 100);
      const voiceQuotaLimitMinutes = Number(entitlements?.monthly_voice_minutes ?? 30);
      const voiceQuotaLimitMs = voiceQuotaLimitMinutes * 60 * 1000;
      const isVoiceQuotaExhausted = currentVoiceUsageMs >= voiceQuotaLimitMs;

      // Extract and validate optional client idempotency key
      const rawIdempotencyKey = (
        request.headers['idempotency-key'] ||
        request.headers['x-idempotency-key'] ||
        (request.body as any)?.idempotencyKey
      );
      const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim().length > 0
        ? rawIdempotencyKey.trim().slice(0, 128)
        : crypto.randomUUID();

      // Compute deterministic request fingerprint for idempotency binding
      const requestFingerprint = crypto.createHash('sha256')
        .update([household.id, child.id, conversation.id, message.trim().toLowerCase(), language || 'en'].join('|'))
        .digest('hex');

      // 3. Concurrency-safe atomic AI session quota check & reservation (prior to upstream execution)
      const tUsageStart = performance.now();
      const initiation = await AppuRequestService.beginAuthenticated(opts.db, {
        householdId: household.id,
        subscriptionId: subscription.id,
        childId: child.id,
        quotaLimit: aiQuotaLimit,
        idempotencyKey,
        requestFingerprint
      });
      const tUsageEnd = performance.now();
      const reservation = initiation.reservation;

      // A stable idempotency key may only start one downstream execution.
      if (initiation.isExisting) {
        const existingLifecycle = initiation.request;
        const isCompleted = reservation.status === 'committed';
        reply.header('idempotency-key', idempotencyKey);
        reply.header('x-appu-request-id', existingLifecycle.id);
        const tTotal = performance.now() - tReqStart;
        reply.header('Server-Timing', `total;dur=${tTotal.toFixed(1)}`);
        return reply.status(isCompleted ? 200 : 202).send({
          childId: child.id,
          conversationId: conversation.id,
          text: isCompleted ? 'This request was already completed.' : null,
          audioSource: null,
          audioDurationMs: null,
          guestSession: null,
          requestId: existingLifecycle.id,
          requestStatus: existingLifecycle.status,
          idempotentReplay: true
        });
      }

      const lifecycle = initiation.request;
      reply.header('idempotency-key', idempotencyKey);
      reply.header('x-appu-request-id', lifecycle.id);
      (request as any).appuRequestId = lifecycle.id;

      // 4. Construct fresh, safe, server-owned MentorContext synchronously from pre-resolved records (0 extra queries)
      const mentorContext = MentorContextBuilder.buildFromResolved(
        child,
        personalisation,
        entitlements
      );

      // Determine effective language intent across explicit instructions, script detection, Kanglish/Hinglish patterns, and learner preference
      const languageIntent = detectLanguageIntent(message, language, mentorContext.primaryLanguage);
      const effectiveLanguage = languageIntent.language;

      const conversationHistory = await ConversationRepository.listContext(
        opts.db,
        household.id,
        child.id,
        conversation.id,
        8
      );

      // 5. Construct structured server-generated envelope for n8n
      // n8n never generates audio itself for the website channel: every language is served via
      // the decoupled Eleven v3 streaming path below (was Kannada/Hindi-only; English previously
      // used n8n's synchronous eleven_turbo_v2_5 Base64 path, which added generation latency to
      // every message and used a different, quieter model than the streaming path).
      const n8nIncludeAudio = false;

      const envelope: N8nMessageEnvelope = {
        requestId: lifecycle.id,
        action: 'sendMessage',
        channel: 'website',
        sessionId: `appu_request_${lifecycle.id}`,
        chatInput: message,
        message,
        language: effectiveLanguage,
        childId: child.id,
        conversationId: conversation.id,
        conversationHistory,
        includeAudio: n8nIncludeAudio,
        ...(imagePayload ? { imageBase64: imagePayload.base64, imageMimeType: imagePayload.mimeType } : {}),
        mentorContext
      };

      // 6. Forward to n8n via secure client with reservation rollback on failure
      const tN8nStart = performance.now();
      let response: any;
      try {
        response = await opts.n8nClient.sendMessage(envelope);
      } catch (error: any) {
        if (error?.code !== ErrorCodes.SERVICE_TEMPORARILY_UNAVAILABLE) {
          await AppuRequestService.reconcile(opts.db, {
            requestId: lifecycle.id,
            outcome: AppuRequestStates.DEFINITE_FAILURE,
            failureCode: error?.code || 'upstream_failure'
          }).catch(() => {});
        } else {
          await AppuRequestRepository.transition(
            opts.db,
            lifecycle.id,
            [AppuRequestStates.PENDING],
            AppuRequestStates.UNKNOWN,
            { failureCode: 'transport_timeout' }
          ).catch(() => {});
        }
        if (error?.name === 'AppError' || error?.statusCode) {
          throw error;
        }
        throw new BadGatewayError('Could not reach AI mentor service. Please try again later.');
      }
      const tN8nEnd = performance.now();

      // 7. Commit usage and lifecycle together after successful upstream response.
      const tPostStart = performance.now();
      await AppuRequestService.reconcile(opts.db, {
        requestId: lifecycle.id,
        outcome: AppuRequestStates.SUCCEEDED
      });

      await ConversationService.appendSuccessfulExchange(opts.db, {
        householdId: household.id,
        childId: child.id,
        conversationId: conversation.id,
        requestId: lifecycle.id,
        userText: message,
        assistantText: response.text,
        hasImageAttachment: Boolean(imagePayload)
      });

      // 8. DUPLICATE TTS SAFETY: If the response text is Kannada or Hindi (even from an English learner
      //    who asked in regional languages or Kanglish/Hinglish), suppress any old n8n-generated audioSource to prevent double billing.
      const isKnResponse = isKannadaResponseText(response.text);
      const isHiResponse = isHindiResponseText(response.text);
      const isRegionalResponse = isKnResponse || isHiResponse;

      if (isRegionalResponse && response.audioSource) {
        request.log.info({ requestId: lifecycle.id }, 'Suppressing n8n-generated audio for regional response; routing to v3 streaming');
        response.audioSource = null;
        response.audioDurationMs = null;
      }

      // 9. Strict Voice Quota Enforcement & Atomic Voice Duration Recording (English path only)
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
            idempotencyKey: `voice_${idempotencyKey}`,
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

      // 10. Decoupled Streaming Audio Authorization (all languages).
      // Pre-gated on !isVoiceQuotaExhausted: voice-minute quota is enforced here (before any
      // ElevenLabs generation cost is spent) and again, based on actual bytes streamed, in
      // appu-audio.ts's GET handler once the stream completes.
      let audioStreamUrl: string | null = null;

      if (includeAudio !== false && !isVoiceQuotaExhausted && response.text && response.text.trim()) {
        try {
          // Piggyback cleanup: delete expired audio authorizations (short retention, no indefinite text storage)
          AppuAudioAuthorizationRepository.deleteExpired(opts.db).catch(() => {});

          const streamLanguage = isKnResponse ? 'kn' : isHiResponse ? 'hi' : 'en';
          await AppuAudioAuthorizationRepository.create(opts.db, {
            requestId: lifecycle.id,
            householdId: household.id,
            childId: child.id,
            approvedText: response.text,
            language: streamLanguage
          });
          audioStreamUrl = `/api/appu/audio/stream?requestId=${lifecycle.id}`;
        } catch (authErr) {
          request.log.warn({ err: authErr, requestId: lifecycle.id }, 'Failed to create audio authorization record');
        }
      }

      const tPostEnd = performance.now();
      const tTotal = performance.now() - tReqStart;

      // Safe performance metrics emission (no secrets or user data)
      reply.header('Server-Timing', [
        `auth;dur=${(tAuthEnd - tReqStart).toFixed(1)}`,
        `household;dur=${(tHouseholdEnd - tHouseholdStart).toFixed(1)}`,
        `context;dur=${(tContextEnd - tContextStart).toFixed(1)}`,
        `usage;dur=${(tUsageEnd - tUsageStart).toFixed(1)}`,
        `n8n;dur=${(tN8nEnd - tN8nStart).toFixed(1)}`,
        `post;dur=${(tPostEnd - tPostStart).toFixed(1)}`,
        `total;dur=${tTotal.toFixed(1)}`
      ].join(', '));

      return reply.status(200).send({
        requestId: lifecycle.id,
        requestStatus: AppuRequestStates.SUCCEEDED,
        childId: child.id,
        conversationId: conversation.id,
        text: response.text,
        audioSource: audioStreamUrl ? null : finalAudioSource,
        audioStreamUrl,
        audioDurationMs: audioStreamUrl ? null : finalAudioDurationMs,
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

    const { message, language, guestToken, includeAudio, imageBase64 } = parseResult.data;

    let imagePayload: { mimeType: string; base64: string } | null = null;
    if (imageBase64) {
      imagePayload = parseImageDataUrl(imageBase64);
      if (!imagePayload) {
        throw new BadRequestError('Invalid image attachment. Must be a PNG, JPEG, or WEBP image under 4MB.', {
          errors: { imageBase64: ['Invalid or oversized image data'] }
        });
      }
    }

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
    const tSessionStart = performance.now();
    const { session } = await GuestSessionService.resolveGuestSession(
      opts.db,
      rawGuestToken,
      clientIp,
      opts.guestSessionSecret
    );
    const tSessionEnd = performance.now();

    const rawIdempotencyKey =
      request.headers['idempotency-key'] || request.headers['x-idempotency-key'];
    const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim()
      ? rawIdempotencyKey.trim().slice(0, 128)
      : crypto.randomUUID();
    const requestFingerprint = crypto.createHash('sha256')
      .update([session.id, message.trim().toLowerCase(), language || 'en'].join('|'))
      .digest('hex');

    // 3. Atomically reserve the guest turn and durable lifecycle in one transaction.
    const tUsageStart = performance.now();
    const initiation = await AppuRequestService.beginGuest(opts.db, {
      session,
      maxTurns: GuestSessionService.DEFAULT_MAX_TURNS,
      idempotencyKey,
      requestFingerprint
    });
    const tUsageEnd = performance.now();

    if (initiation.isExisting) {
      reply.header('idempotency-key', idempotencyKey);
      reply.header('x-appu-request-id', initiation.request.id);
      const completed = initiation.request.status === AppuRequestStates.SUCCEEDED;
      const tTotal = performance.now() - tReqStart;
      reply.header('Server-Timing', `total;dur=${tTotal.toFixed(1)}`);
      return reply.status(completed ? 200 : 202).send({
        requestId: initiation.request.id,
        requestStatus: initiation.request.status,
        idempotentReplay: true,
        text: completed ? 'This request was already completed.' : null,
        audioSource: null,
        audioDurationMs: null
      });
    }

    reply.header('idempotency-key', idempotencyKey);
    reply.header('x-appu-request-id', initiation.request.id);
    (request as any).appuRequestId = initiation.request.id;

    // 4. Construct safe server-generated guest envelope for n8n
    const languageIntent = detectLanguageIntent(message, language, 'en');
    const effectiveLanguage = languageIntent.language;

    // n8n never generates audio itself; all languages route through the decoupled stream below.
    const n8nIncludeAudio = false;

    const mentorContext: GuestMentorContext = {
      mode: 'guest',
      primaryLanguage: effectiveLanguage,
      personalizationEnabled: false
    };

    const envelope: N8nMessageEnvelope = {
      requestId: initiation.request.id,
      action: 'sendMessage',
      channel: 'website',
      sessionId: `appu_guest_${session.id}`,
      chatInput: message,
      message,
      language: effectiveLanguage,
      includeAudio: n8nIncludeAudio,
      ...(imagePayload ? { imageBase64: imagePayload.base64, imageMimeType: imagePayload.mimeType } : {}),
      mentorContext
    };

    // 5. Forward to n8n AI workflow with failsafe rollback on error
    const tN8nStart = performance.now();
    let response: any;
    try {
      response = await opts.n8nClient.sendMessage(envelope);
    } catch (error: any) {
      if (error?.code === ErrorCodes.SERVICE_TEMPORARILY_UNAVAILABLE) {
        await AppuRequestRepository.transition(
          opts.db,
          initiation.request.id,
          [AppuRequestStates.PENDING],
          AppuRequestStates.UNKNOWN,
          { failureCode: 'transport_timeout' }
        ).catch(() => {});
      } else {
        await AppuRequestService.reconcile(opts.db, {
          requestId: initiation.request.id,
          outcome: AppuRequestStates.DEFINITE_FAILURE,
          failureCode: error?.code || 'upstream_failure'
        }).catch(() => {});
      }
      if (error?.name === 'AppError' || error?.statusCode) {
        throw error;
      }
      throw new BadGatewayError('Could not reach AI mentor service. Please try again later.');
    }
    const tN8nEnd = performance.now();

    // 6. Generate signed token reflecting the successfully completed turn count
    const guestTokenResult = GuestSessionService.signGuestToken({
      id: session.id,
      turns: initiation.used,
      exp: session.expiresAt.getTime(),
      ipHash: session.ipHash
    }, opts.guestSessionSecret);

    // 7. Guest Decoupled Streaming Audio Authorization (all languages).
    // No voice-minute quota here -- guests are limited by turn count only, unchanged.
    const isKnResponse = isKannadaResponseText(response.text || '');
    const isHiResponse = isHindiResponseText(response.text || '');
    let guestAudioStreamUrl: string | null = null;

    if (includeAudio !== false && response.text && response.text.trim()) {
      try {
        AppuAudioAuthorizationRepository.deleteExpired(opts.db).catch(() => {});

        const streamLanguage = isKnResponse ? 'kn' : isHiResponse ? 'hi' : 'en';
        await AppuAudioAuthorizationRepository.createForGuest(opts.db, {
          requestId: initiation.request.id,
          guestSessionId: session.id,
          approvedText: response.text,
          language: streamLanguage
        });
        guestAudioStreamUrl = `/api/appu/audio/stream?requestId=${initiation.request.id}`;
      } catch (authErr) {
        request.log.warn({ err: authErr, requestId: initiation.request.id }, 'Failed to create guest audio authorization record');
      }
    }

    // 8. Deliver response with updated guest session metadata and signed token
    const tPostStart = performance.now();
    await AppuRequestService.reconcile(opts.db, {
      requestId: initiation.request.id,
      outcome: AppuRequestStates.SUCCEEDED
    });
    const tPostEnd = performance.now();
    const tTotal = performance.now() - tReqStart;

    reply.header('Server-Timing', [
      `session;dur=${(tSessionEnd - tSessionStart).toFixed(1)}`,
      `usage;dur=${(tUsageEnd - tUsageStart).toFixed(1)}`,
      `n8n;dur=${(tN8nEnd - tN8nStart).toFixed(1)}`,
      `post;dur=${(tPostEnd - tPostStart).toFixed(1)}`,
      `total;dur=${tTotal.toFixed(1)}`
    ].join(', '));

    reply.header('x-guest-session-token', guestTokenResult);
    return reply.status(200).send({
      requestId: initiation.request.id,
      requestStatus: AppuRequestStates.SUCCEEDED,
      text: response.text,
      audioSource: guestAudioStreamUrl ? null : (response.audioSource || null),
      audioStreamUrl: guestAudioStreamUrl,
      audioDurationMs: guestAudioStreamUrl ? null : (response.audioDurationMs || null),
      guest: {
        token: guestTokenResult,
        limit: GuestSessionService.DEFAULT_MAX_TURNS,
        used: initiation.used,
        remaining: initiation.remaining,
        loginRequired: initiation.remaining === 0
      },
      guestSession: {
        token: guestTokenResult,
        guestLimit: GuestSessionService.DEFAULT_MAX_TURNS,
        used: initiation.used,
        remaining: initiation.remaining,
        loginRequired: initiation.remaining === 0
      }
    });
  });
};
