import type { FastifyPluginAsync } from 'fastify';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';

export interface AuthRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (fastify, opts) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * GET /api/auth/me
   * Returns safe authenticated identity and current household context.
   */
  fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const householdContext = await HouseholdAuthorizationService.getPrimaryHouseholdForUser(
      opts.db,
      principal.userId
    );

    return reply.status(200).send({
      authenticated: true,
      userId: principal.userId,
      household: householdContext
        ? {
            id: householdContext.household.id,
            name: householdContext.household.name,
            role: householdContext.member.role
          }
        : null
    });
  });
};
