import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import type { RazorpayClient } from '../domain/razorpay/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { SubscriptionService } from '../domain/subscription/service.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface SubscriptionsRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  razorpayClient: RazorpayClient;
  razorpayKeyId?: string;
}

const createSubscriptionSchema = z.object({
  planCode: z.string().min(1, 'planCode is required')
});

const verifyCheckoutSchema = z.object({
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySubscriptionId: z.string().min(1, 'razorpaySubscriptionId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required')
});

export const subscriptionsRoutes: FastifyPluginAsync<SubscriptionsRouteOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * POST /api/subscriptions
   * Creates a new pending subscription with Razorpay for the authorized parent.
   */
  fastify.post('/api/subscriptions', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const bodyResult = createSubscriptionSchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw new BadRequestError('Invalid subscription request payload', {
        errors: bodyResult.error.flatten().fieldErrors
      });
    }

    // 1. Resolve and enforce parent's household
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Create subscription via service
    const result = await SubscriptionService.createSubscription(opts.db, opts.razorpayClient, {
      householdId: household.id,
      planCode: bodyResult.data.planCode
    });

    return reply.status(201).send({
      subscriptionId: result.subscription.id,
      providerSubscriptionId: result.providerSubscriptionId,
      keyId: opts.razorpayKeyId,
      planCode: result.plan.code,
      planName: result.plan.name,
      amountPaise: result.plan.amountPaise,
      currency: result.plan.currency,
      status: result.subscription.status,
      shortUrl: result.shortUrl,
      isFree: result.isFree || false
    });
  });

  /**
   * POST /api/subscriptions/verify-checkout
   * Verifies standard checkout signature and transitions subscription to AUTHENTICATED.
   */
  fastify.post(
    '/api/subscriptions/verify-checkout',
    { preHandler: requireAuth },
    async (request, reply) => {
      const principal = request.principal!;

      const bodyResult = verifyCheckoutSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw new BadRequestError('Invalid checkout verification payload', {
          errors: bodyResult.error.flatten().fieldErrors
        });
      }

      // 1. Resolve parent's household
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      // 2. Verify checkout signature
      const result = await SubscriptionService.verifyCheckoutSignature(
        opts.db,
        opts.razorpayClient,
        {
          householdId: household.id,
          paymentId: bodyResult.data.razorpayPaymentId,
          subscriptionId: bodyResult.data.razorpaySubscriptionId,
          signature: bodyResult.data.razorpaySignature
        }
      );

      return reply.status(200).send({
        verified: result.verified,
        status: result.subscription.status
      });
    }
  );

  /**
   * GET /api/subscriptions/current
   * Returns current subscription status and active entitlements for the household.
   */
  fastify.get('/api/subscriptions/current', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const subscription = await SubscriptionRepository.getLatestSubscriptionForHousehold(
      opts.db,
      household.id
    );

    if (!subscription) {
      return reply.status(200).send({
        hasSubscription: false,
        subscription: null,
        entitlements: null
      });
    }

    const plan = await SubscriptionRepository.getPlanById(opts.db, subscription.planId);

    return reply.status(200).send({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        planCode: plan?.code ?? subscription.planCode,
        status: subscription.status,
        providerSubscriptionId: subscription.providerSubscriptionId,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      },
      // Paid entitlements active only when status is ACTIVE
      entitlements: subscription.status === 'ACTIVE' ? plan?.entitlements ?? null : null
    });
  });
};
