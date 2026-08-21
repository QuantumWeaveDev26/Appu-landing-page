import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { TenancyService } from '../domain/tenancy/service.js';
import { BadRequestError } from '../errors/index.js';

export interface HouseholdRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

const onboardSchema = z.object({
  householdName: z.string().max(255, 'householdName must not exceed 255 characters').optional()
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
};
