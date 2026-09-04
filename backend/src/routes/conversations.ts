import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import {
  ConversationRepository,
  ConversationService
} from '../domain/conversation/index.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface ConversationRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
}

const childQuerySchema = z.object({
  childId: z.string().uuid()
});

const conversationParamsSchema = z.object({
  conversationId: z.string().uuid()
});

const createConversationSchema = z.object({
  childId: z.string().uuid(),
  firstMessage: z.string().trim().max(2000).optional()
});

export const conversationRoutes: FastifyPluginAsync<ConversationRouteOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  /**
   * POST /api/appu/conversations
   * Body: { childId, firstMessage? } -> 201 { conversation: {...} }
   */
  fastify.post('/api/appu/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = createConversationSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid conversation payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const principal = request.principal!;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(
      opts.db,
      household.id,
      parseResult.data.childId
    );
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const conversation = await ConversationService.createAndPrune(
      opts.db,
      household.id,
      child.id,
      parseResult.data.firstMessage
    );

    return reply.status(201).send({ conversation });
  });

  /**
   * GET /api/appu/conversations?childId=<uuid>
   * Query: { childId } -> 200 { conversations: [...] }
   */
  fastify.get('/api/appu/conversations', { preHandler: requireAuth }, async (request, reply) => {
    const queryResult = childQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new BadRequestError('Invalid childId in query parameters', {
        errors: queryResult.error.flatten().fieldErrors
      });
    }

    const principal = request.principal!;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(
      opts.db,
      household.id,
      queryResult.data.childId
    );
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const conversations = await ConversationRepository.listRecent(
      opts.db,
      household.id,
      child.id,
      30
    );

    return reply.status(200).send({ conversations });
  });

  /**
   * GET /api/appu/conversations/:conversationId/messages?childId=<uuid>
   * Returns up to 100 stored messages for one owned non-expired conversation.
   */
  fastify.get(
    '/api/appu/conversations/:conversationId/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsResult = conversationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new BadRequestError('Invalid conversationId parameter', {
          errors: paramsResult.error.flatten().fieldErrors
        });
      }

      const queryResult = childQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new BadRequestError('Invalid childId in query parameters', {
          errors: queryResult.error.flatten().fieldErrors
        });
      }

      const principal = request.principal!;
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      const child = await TenancyRepository.getChildProfile(
        opts.db,
        household.id,
        queryResult.data.childId
      );
      if (!child) {
        throw new NotFoundError('Child profile not found');
      }

      const conversation = await ConversationRepository.getOwned(
        opts.db,
        household.id,
        child.id,
        paramsResult.data.conversationId
      );
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const messages = await ConversationRepository.listMessages(
        opts.db,
        household.id,
        child.id,
        conversation.id,
        100
      );

      return reply.status(200).send({ messages });
    }
  );

  /**
   * DELETE /api/appu/conversations/:conversationId?childId=<uuid>
   * Deletes one owned conversation. Returns 204 or 404.
   */
  fastify.delete(
    '/api/appu/conversations/:conversationId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const paramsResult = conversationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw new BadRequestError('Invalid conversationId parameter', {
          errors: paramsResult.error.flatten().fieldErrors
        });
      }

      const queryResult = childQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new BadRequestError('Invalid childId in query parameters', {
          errors: queryResult.error.flatten().fieldErrors
        });
      }

      const principal = request.principal!;
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      const child = await TenancyRepository.getChildProfile(
        opts.db,
        household.id,
        queryResult.data.childId
      );
      if (!child) {
        throw new NotFoundError('Child profile not found');
      }

      const deleted = await ConversationRepository.deleteOwned(
        opts.db,
        household.id,
        child.id,
        paramsResult.data.conversationId
      );
      if (!deleted) {
        throw new NotFoundError('Conversation not found');
      }

      return reply.status(204).send();
    }
  );

  /**
   * DELETE /api/appu/conversations?childId=<uuid>
   * Deletes all owned conversations for the child. Returns 204.
   */
  fastify.delete(
    '/api/appu/conversations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const queryResult = childQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        throw new BadRequestError('Invalid childId in query parameters', {
          errors: queryResult.error.flatten().fieldErrors
        });
      }

      const principal = request.principal!;
      const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
        opts.db,
        principal.userId
      );

      const child = await TenancyRepository.getChildProfile(
        opts.db,
        household.id,
        queryResult.data.childId
      );
      if (!child) {
        throw new NotFoundError('Child profile not found');
      }

      await ConversationRepository.deleteAllOwned(opts.db, household.id, child.id);

      return reply.status(204).send();
    }
  );
};
