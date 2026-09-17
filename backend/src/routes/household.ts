import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { TenancyService } from '../domain/tenancy/service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { FamilyFeedbackService } from '../domain/feedback/index.js';
import { isUnlimitedEmail, ensureUnlimitedSubscription } from '../domain/entitlements/index.js';
import { BadRequestError } from '../errors/index.js';

export interface HouseholdRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  n8nFeedbackWebhookUrl?: string;
  unlimitedEmails?: string;
}

const onboardSchema = z.object({
  householdName: z.string().max(255, 'householdName must not exceed 255 characters').optional()
});

const updateNotificationSchema = z.object({
  parentPhone: z.string().nullable().optional(),
  whatsappConsent: z.boolean().optional()
});

const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  whatsWorking: z
    .string({ required_error: "What's working is required" })
    .trim()
    .min(1, "What's working cannot be empty")
    .max(2000),
  whatsToImprove: z
    .string({ required_error: "What's to improve is required" })
    .trim()
    .min(1, "What's to improve cannot be empty")
    .max(2000)
});

export const householdRoutes: FastifyPluginAsync<HouseholdRouteOptions> = async (fastify, opts) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * POST /api/household/onboard
   * Atomically and idempotently onboards the authenticated parent into a household with OWNER role.
   */
  fastify.post('/api/household/onboard', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const parseResult = onboardSchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      throw new BadRequestError('Invalid onboarding payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { household, member, isNew } = await TenancyService.onboardParentHousehold(opts.db, {
      userId: principal.userId,
      householdName: parseResult.data.householdName
    });

    if (isUnlimitedEmail(principal.email, opts.unlimitedEmails)) {
      await ensureUnlimitedSubscription(opts.db, household.id);
    }

    const statusCode = isNew ? 201 : 200;

    return reply.status(statusCode).send({
      household: {
        id: household.id,
        name: household.name
      },
      role: member.role,
      isNew
    });
  });

  /**
   * GET /api/household/notifications
   * Retrieves notification and WhatsApp communication preferences for the authenticated parent's household.
   */
  fastify.get('/api/household/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const preferences = await TenancyRepository.getNotificationPreferences(opts.db, household.id);

    return reply.status(200).send({
      parentPhone: preferences.parentPhone,
      whatsappConsent: preferences.whatsappConsent,
      whatsappConsentAt: preferences.whatsappConsentAt ? preferences.whatsappConsentAt.toISOString() : null
    });
  });

  /**
   * PATCH /api/household/notifications
   * Updates notification and WhatsApp communication preferences for the authenticated parent's household.
   */
  fastify.patch('/api/household/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = updateNotificationSchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      throw new BadRequestError('Invalid notification preferences payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    try {
      const preferences = await TenancyRepository.updateNotificationPreferences(
        opts.db,
        household.id,
        parseResult.data
      );

      return reply.status(200).send({
        parentPhone: preferences.parentPhone,
        whatsappConsent: preferences.whatsappConsent,
        whatsappConsentAt: preferences.whatsappConsentAt ? preferences.whatsappConsentAt.toISOString() : null
      });
    } catch (err: any) {
      throw new BadRequestError(err.message || 'Invalid notification preferences');
    }
  });

  /**
   * POST /api/household/feedback
   * Submits structured parent feedback for the authenticated parent's household, unlocking performance reports.
   */
  fastify.post('/api/household/feedback', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = submitFeedbackSchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      throw new BadRequestError('Invalid feedback payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const result = await FamilyFeedbackService.saveFeedback(
      opts.db,
      household.id,
      {
        rating: parseResult.data.rating,
        whatsWorking: parseResult.data.whatsWorking,
        whatsToImprove: parseResult.data.whatsToImprove
      },
      {
        source: 'web',
        webhookUrl: opts.n8nFeedbackWebhookUrl
      }
    );

    return reply.status(200).send(result);
  });

  /**
   * GET /api/household/feedback
   * Retrieves feedback status and unlock state for the authenticated parent's household.
   */
  fastify.get('/api/household/feedback', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const result = await FamilyFeedbackService.getStatus(opts.db, household.id);
    return reply.status(200).send(result);
  });
};


