import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { PromptService } from '../domain/prompts/prompt-service.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface PromptsRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

const paramsSchema = z.object({
  childId: z.string().uuid('Invalid childId format. Must be a valid UUID')
});

const querySchema = z.object({
  category: z.enum(['quick_concepts', 'homework_hints', 'curious_mind', 'exam_drills']).optional()
});

export const promptsRoutes: FastifyPluginAsync<PromptsRouteOptions> = async (fastify, opts) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * GET /api/children/:childId/prompts
   * Retrieves or lazily generates personalized prompt suggestions for a child.
   * Optional ?category= filter limits results to a specific prompt category.
   */
  fastify.get('/api/children/:childId/prompts', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      throw new BadRequestError('Invalid childId parameter', {
        errors: paramsResult.error.flatten().fieldErrors
      });
    }

    const queryResult = querySchema.safeParse(request.query ?? {});
    if (!queryResult.success) {
      throw new BadRequestError('Invalid query parameters', {
        errors: queryResult.error.flatten().fieldErrors
      });
    }

    const { childId } = paramsResult.data;
    const { category } = queryResult.data;

    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const allPrompts = await PromptService.getOrGeneratePrompts(opts.db, household.id, child.id);
    const prompts = category
      ? allPrompts.filter((p) => p.category === category)
      : allPrompts;

    return reply.status(200).send({ prompts });
  });

  /**
   * POST /api/children/:childId/prompts/regenerate
   * Atomically invalidates and regenerates personalized prompts for a child.
   */
  fastify.post('/api/children/:childId/prompts/regenerate', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      throw new BadRequestError('Invalid childId parameter', {
        errors: paramsResult.error.flatten().fieldErrors
      });
    }

    const { childId } = paramsResult.data;

    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const prompts = await PromptService.regeneratePrompts(opts.db, household.id, child.id);

    return reply.status(200).send({ prompts });
  });
};
