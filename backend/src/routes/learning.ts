import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { EVENT_SOURCES, LESSON_MODES, LearnerModelService } from '../domain/learner-model/index.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface LearningRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

const childParams = z.object({ childId: z.string().uuid() });
const consentBody = z.object({ granted: z.boolean() }).strict();
const eventsBody = z
  .object({
    childId: z.string().uuid(),
    events: z
      .array(
        z
          .object({
            source: z.enum(EVENT_SOURCES),
            topic: z.string().trim().min(1).max(120),
            isCorrect: z.boolean().nullable().optional(),
            mode: z.enum(LESSON_MODES).nullable().optional(),
            question: z.string().max(300).nullable().optional()
          })
          .strict()
      )
      .min(1)
      .max(20)
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestError(`Invalid ${what}`, { errors: r.error.flatten().fieldErrors });
  return r.data;
}

/**
 * Learning tracking: parent consent, evidence from lessons, and the measured learner profile.
 *   GET  /api/children/:childId/learning          -> { consent, model, topics }
 *   PUT  /api/children/:childId/learning-consent  { granted } -> { granted }
 *   POST /api/appu/learning/events                { childId, events[] } -> { recorded }
 */
export const learningRoutes: FastifyPluginAsync<LearningRouteOptions> = async (fastify, opts) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  async function ownedChild(userId: string, childId: string) {
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(opts.db, userId);
    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
    if (!child) throw new NotFoundError('Child profile not found');
    return { householdId: household.id, childId: child.id };
  }

  fastify.get('/api/children/:childId/learning', { preHandler: requireAuth }, async (request) => {
    const { childId } = parse(childParams, request.params, 'childId parameter');
    const owned = await ownedChild(request.principal!.userId, childId);
    const decision = await LearnerModelService.getDecision(opts.db, owned.householdId, owned.childId);
    // decided = false: the parent has not chosen yet (forms show the box ticked; nothing is recorded until they save).
    if (!decision || !decision.granted) {
      return { consent: { granted: false, decided: Boolean(decision) }, model: null, topics: [] };
    }
    const consent = { grantedAt: decision.decidedAt, policyVersion: decision.policyVersion };
    const [model, topics] = await Promise.all([
      LearnerModelService.buildModel(opts.db, owned.householdId, owned.childId),
      LearnerModelService.listTopics(opts.db, owned.householdId, owned.childId)
    ]);
    return {
      consent: { granted: true, decided: true, grantedAt: consent.grantedAt.toISOString(), policyVersion: consent.policyVersion },
      model,
      topics
    };
  });

  fastify.put('/api/children/:childId/learning-consent', { preHandler: requireAuth }, async (request) => {
    const { childId } = parse(childParams, request.params, 'childId parameter');
    const { granted } = parse(consentBody, request.body, 'consent body');
    const owned = await ownedChild(request.principal!.userId, childId);
    await LearnerModelService.setConsent(opts.db, owned.householdId, owned.childId, request.principal!.userId, granted);
    return { granted };
  });

  fastify.post('/api/appu/learning/events', { preHandler: requireAuth }, async (request) => {
    const body = parse(eventsBody, request.body, 'learning events');
    const owned = await ownedChild(request.principal!.userId, body.childId);
    const recorded = await LearnerModelService.recordEvents(opts.db, owned.householdId, owned.childId, body.events);
    return { recorded };
  });
};
