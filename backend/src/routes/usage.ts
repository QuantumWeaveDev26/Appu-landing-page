import type { FastifyPluginAsync } from 'fastify';
import type { Queryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { UsageService } from '../domain/usage/service.js';

export interface UsageRouteOptions {
  db: Queryable;
  authVerifier: AuthVerifier;
}

export const usageRoutes: FastifyPluginAsync<UsageRouteOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * GET /api/usage/current
   * Returns authoritative usage summary for the authenticated parent's household.
   * Derived strictly from server authentication state.
   */
  fastify.get('/api/usage/current', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    // 1. Resolve and verify parent's household authorization
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Fetch authoritative usage summary
    const summary = await UsageService.getHouseholdUsageSummary(opts.db, household.id);

    return reply.status(200).send(summary);
  });
};
