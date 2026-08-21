import type { FastifyPluginAsync } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';
import { EntitlementEnforcementService } from '../domain/entitlements/enforcement-service.js';
import { UsageService } from '../domain/usage/service.js';
import { AIContextBuilder } from '../domain/personalisation/ai-context-builder.js';
import type { N8nClient, N8nMessageEnvelope } from '../domain/gateway/index.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  BadGatewayError
} from '../errors/index.js';

export interface AppuGatewayRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  n8nClient: N8nClient;
}

const messageRequestSchema = z.object({
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

export const appuGatewayRoutes: FastifyPluginAsync<AppuGatewayRouteOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * POST /api/appu/message
   * Secure backend gateway routing child messages to the live n8n AI mentor workflow.
   * Enforces parent authentication, household tenant isolation, ACTIVE subscription gating,
   * server-side entitlement derivation, concurrency-safe AI quota reservation, and child personalisation context injection.
   */
  fastify.post('/api/appu/message', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const parseResult = messageRequestSchema.safeParse(request.body);
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

    // 3. Require ACTIVE subscription for paid AI mentor access
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

    // Extract and validate optional client idempotency key
    const rawIdempotencyKey = (
      request.headers['idempotency-key'] ||
      request.headers['x-idempotency-key'] ||
      (request.body as any)?.idempotencyKey
    );
    const idempotencyKey = typeof rawIdempotencyKey === 'string' && rawIdempotencyKey.trim().length > 0
      ? rawIdempotencyKey.trim().slice(0, 128)
      : null;

    // Compute deterministic request fingerprint for idempotency binding.
    // Ensures a client cannot reuse one idempotency key for a logically different message.
    // Fingerprint: SHA-256(householdId + childId + normalizedMessage + language)
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

    // 5. Build safe server-owned child AI context
    const aiContext = await AIContextBuilder.buildChildAIContext(
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
      language: language || aiContext.preferences.language || 'en',
      childId: child.id,
      context: aiContext
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

    return reply.status(200).send({
      childId: child.id,
      text: response.text,
      audioSource: response.audioSource
    });
  });
};
