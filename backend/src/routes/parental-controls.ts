import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import type { AuthVerifier } from '../domain/auth/types.js';
import { createAuthPreHandler } from '../middleware/auth.js';
import { HouseholdAuthorizationService } from '../domain/authorization/household-auth-service.js';
import { TenancyRepository } from '../domain/tenancy/repository.js';
import { ParentalControlsService } from '../domain/parental-controls/index.js';
import { BadRequestError, NotFoundError } from '../errors/index.js';

export interface ParentalControlsRouteOptions {
  db: TransactionalQueryable;
  authVerifier: AuthVerifier;
  enabled?: boolean;
  lockIntervalSeconds?: number;
  n8nWebhookUrl?: string;
  fetchFn?: typeof fetch;
}

const heartbeatSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId cannot be empty').max(128),
  childId: z.string().uuid('Invalid childId format'),
  activeMsSinceLast: z.number().int().min(0).max(600000).optional().default(0),
  awayMsSinceLast: z.number().int().min(0).max(600000).optional().default(0),
  visibility: z.enum(['visible', 'hidden']).optional().default('visible')
});

const requestOtpSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId cannot be empty').max(128),
  childId: z.string().uuid('Invalid childId format')
});

const verifyOtpSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId cannot be empty').max(128),
  childId: z.string().uuid('Invalid childId format'),
  code: z.string().trim().min(4).max(10)
});

const sendNoteSchema = z.object({
  childId: z.string().uuid('Invalid childId format'),
  note: z.string().trim().min(1, 'Note cannot be empty').max(1000, 'Note must not exceed 1000 characters')
});

const usageQuerySchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId cannot be empty').max(128),
  childId: z.string().uuid('Invalid childId format')
});

export const parentalControlsRoutes: FastifyPluginAsync<ParentalControlsRouteOptions> = async (
  fastify,
  opts
) => {
  const requireAuth = createAuthPreHandler(opts.authVerifier);

  const serviceOpts = {
    enabled: opts.enabled,
    lockIntervalSeconds: opts.lockIntervalSeconds,
    n8nWebhookUrl: opts.n8nWebhookUrl,
    fetchFn: opts.fetchFn,
    logger: fastify.log
  };

  /**
   * POST /api/appu/notes/send-whatsapp
   * Server-sends the study note directly to the parent's verified WhatsApp number.
   */
  fastify.post('/api/appu/notes/send-whatsapp', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = sendNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid study note payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { childId, note } = parseResult.data;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const result = await ParentalControlsService.sendStudyNoteToWhatsApp(
      opts.db,
      household.id,
      { childId, note },
      serviceOpts
    );

    return reply.status(200).send(result);
  });

  /**
   * POST /api/appu/session/heartbeat
   * Periodic client heartbeat accumulating active and away milliseconds for parental controls window.
   */
  fastify.post('/api/appu/session/heartbeat', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = heartbeatSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid session heartbeat payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const input = parseResult.data;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, input.childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const result = await ParentalControlsService.recordHeartbeat(
      opts.db,
      household.id,
      input,
      serviceOpts
    );

    return reply.status(200).send(result);
  });

  /**
   * POST /api/appu/session/otp/request
   * Requests a 6-digit OTP to unlock session after the 30-min window, delivered to parent WhatsApp.
   */
  fastify.post('/api/appu/session/otp/request', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = requestOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid OTP request payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const input = parseResult.data;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, input.childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const result = await ParentalControlsService.requestOtp(
      opts.db,
      household.id,
      input,
      serviceOpts
    );

    return reply.status(200).send(result);
  });

  /**
   * POST /api/appu/session/otp/verify
   * Verifies the 6-digit OTP code and resets the 30-minute usage window upon success.
   */
  fastify.post('/api/appu/session/otp/verify', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = verifyOtpSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid OTP verify payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const input = parseResult.data;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, input.childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const result = await ParentalControlsService.verifyOtp(
      opts.db,
      household.id,
      input,
      serviceOpts
    );

    return reply.status(200).send(result);
  });

  /**
   * GET /api/appu/session/usage
   * Queries the current active/away usage metrics and lock state for a session.
   */
  fastify.get('/api/appu/session/usage', { preHandler: requireAuth }, async (request, reply) => {
    const principal = request.principal!;
    const parseResult = usageQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid usage query parameters', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const { childId, sessionId } = parseResult.data;
    const { household } = await HouseholdAuthorizationService.requireHouseholdMembership(
      opts.db,
      principal.userId
    );

    const child = await TenancyRepository.getChildProfile(opts.db, household.id, childId);
    if (!child) {
      throw new NotFoundError('Child profile not found');
    }

    const result = await ParentalControlsService.getSessionUsage(
      opts.db,
      household.id,
      childId,
      sessionId,
      serviceOpts
    );

    return reply.status(200).send(result);
  });
};
