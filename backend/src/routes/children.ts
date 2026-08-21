import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface ChildrenRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

const createChildSchema = z.object({
  preferredName: z.string().trim().min(1, 'preferredName is required').max(100, 'preferredName must not exceed 100 characters'),
  gradeBand: z.string().trim().min(1, 'gradeBand is required').max(50, 'gradeBand must not exceed 50 characters'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional().default('ACTIVE')
});

const updateChildSchema = z.object({
  preferredName: z.string().trim().min(1, 'preferredName cannot be empty').max(100).optional(),
  gradeBand: z.string().trim().min(1, 'gradeBand cannot be empty').max(50).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
});

const paramsSchema = z.object({
  childId: z.string().uuid('Invalid childId format. Must be a valid UUID')
});

export const childrenRoutes: FastifyPluginAsync<ChildrenRouteOptions> = async (fastify, opts) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * POST /api/children
   * Creates a new child profile under the verified parent's authorized household.
   */
  fastify.post('/api/children', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const parseResult = createChildSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid child profile payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    // 1. Resolve and verify parent's household authorization
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Create child profile bound strictly to the derived household ID
    const child = await TenancyRepository.createChildProfile(opts.db, {
      householdId: household.id,
      preferredName: parseResult.data.preferredName,
      gradeBand: parseResult.data.gradeBand,
      status: parseResult.data.status
    });

    return reply.status(201).send({
      child: {
        id: child.id,
        householdId: child.householdId,
        preferredName: child.preferredName,
        gradeBand: child.gradeBand,
        status: child.status,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt
      }
    });
  });

  /**
   * GET /api/children
   * Lists all child profiles belonging strictly to the verified parent's household.
   */
  fastify.get('/api/children', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    // 1. Resolve and verify parent's household authorization
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Query child profiles scoped to the verified household
    const children = await TenancyRepository.listChildProfilesByHousehold(opts.db, household.id);

    return reply.status(200).send({
      children: children.map((c) => ({
        id: c.id,
        householdId: c.householdId,
        preferredName: c.preferredName,
        gradeBand: c.gradeBand,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }))
    });
  });

  /**
   * GET /api/children/:childId
   * Retrieves a specific child profile scoped to the verified parent's household.
   * If the child belongs to another household, returns 404 without leaking existence.
   */
  fastify.get('/api/children/:childId', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      throw new BadRequestError('Invalid childId parameter', {
        errors: paramsResult.error.flatten().fieldErrors
      });
    }

    const { childId } = paramsResult.data;

    // 1. Resolve parent's authorized household
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Query child strictly scoped by BOTH household.id AND childId
    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);

    if (!child) {
      // Safe 404: never leak whether child exists in an unrelated household
      throw new NotFoundError('Child profile not found');
    }

    return reply.status(200).send({
      child: {
        id: child.id,
        householdId: child.householdId,
        preferredName: child.preferredName,
        gradeBand: child.gradeBand,
        status: child.status,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt
      }
    });
  });

  /**
   * PATCH /api/children/:childId
   * Updates a specific child profile scoped to the verified parent's household.
   */
  fastify.patch('/api/children/:childId', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;

    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      throw new BadRequestError('Invalid childId parameter', {
        errors: paramsResult.error.flatten().fieldErrors
      });
    }

    const bodyResult = updateChildSchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      throw new BadRequestError('Invalid child update payload', {
        errors: bodyResult.error.flatten().fieldErrors
      });
    }

    const { childId } = paramsResult.data;

    // 1. Resolve parent's authorized household
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    // 2. Perform update strictly scoped by BOTH household.id AND childId
    const updatedChild = await TenancyRepository.updateChildProfile(
      opts.db,
      household.id,
      childId,
      bodyResult.data
    );

    if (!updatedChild) {
      throw new NotFoundError('Child profile not found');
    }

    return reply.status(200).send({
      child: {
        id: updatedChild.id,
        householdId: updatedChild.householdId,
        preferredName: updatedChild.preferredName,
        gradeBand: updatedChild.gradeBand,
        status: updatedChild.status,
        createdAt: updatedChild.createdAt,
        updatedAt: updatedChild.updatedAt
      }
    });
  });
};
