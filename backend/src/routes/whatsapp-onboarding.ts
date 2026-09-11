import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { WhatsAppOnboardingService, REQUIRED_ONBOARDING_FIELDS } from '../domain/whatsapp/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/index.js';

export interface WhatsAppOnboardingRouteOptions {
  db: TransactionalQueryable;
  signingSecret: string;
  signatureMaxAgeSeconds?: number;
  betaChatLimit?: number;
}

const stateRequestSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long')
  })
  .strict();

const singleFieldSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long'),
    field: z
      .string({ required_error: 'field is required' })
      .trim()
      .min(1, 'field cannot be empty'),
    value: z.unknown()
  })
  .strict();

const batchFieldsSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long'),
    fields: z
      .record(z.unknown())
      .refine((obj) => Object.keys(obj).length > 0, 'fields object must not be empty')
  })
  .strict();

const saveStepRequestSchema = z.union([singleFieldSchema, batchFieldsSchema]);

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

export const whatsappOnboardingRoutes: FastifyPluginAsync<WhatsAppOnboardingRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * POST /api/appu/whatsapp/onboarding/state
   * Resolves learner onboarding completeness and current personalization state for an inbound WhatsApp phone number.
   * Authenticated strictly via HMAC-SHA256 signature.
   */
  fastify.post('/api/appu/whatsapp/onboarding/state', async (request, reply) => {
    // 1. Enforce strict HMAC-SHA256 authentication
    const verification = verifyAppuHmacSignature({
      rawBody: rawBodyOf(request),
      timestampHeader: request.headers['x-appu-timestamp'] as string | undefined,
      signatureHeader: request.headers['x-appu-signature'] as string | undefined,
      secret: opts.signingSecret,
      maxAgeSeconds: opts.signatureMaxAgeSeconds ?? 300
    });

    if (!verification.valid) {
      throw new UnauthorizedError('Invalid or expired APPU request signature');
    }

    // 2. Validate request payload
    const parsed = stateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid WhatsApp onboarding state request payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { phone } = parsed.data;

    // 3. Resolve onboarding state via domain service with fail-safe guarantee
    try {
      const result = await WhatsAppOnboardingService.getState(opts.db, phone);
      return reply.status(200).send(result);
    } catch {
      return reply.status(200).send({
        recognized: false,
        complete: false,
        missingFields: [...REQUIRED_ONBOARDING_FIELDS],
        nextPromptField: REQUIRED_ONBOARDING_FIELDS[0],
        householdId: null,
        childId: null,
        personalisation: null
      });
    }
  });

  /**
   * POST /api/appu/whatsapp/onboarding/save-step
   * Atomically saves one or more onboarding fields, creating phone-only household & child if needed.
   * Authenticated strictly via HMAC-SHA256 signature.
   */
  fastify.post('/api/appu/whatsapp/onboarding/save-step', async (request, reply) => {
    // 1. Enforce strict HMAC-SHA256 authentication
    const verification = verifyAppuHmacSignature({
      rawBody: rawBodyOf(request),
      timestampHeader: request.headers['x-appu-timestamp'] as string | undefined,
      signatureHeader: request.headers['x-appu-signature'] as string | undefined,
      secret: opts.signingSecret,
      maxAgeSeconds: opts.signatureMaxAgeSeconds ?? 300
    });

    if (!verification.valid) {
      throw new UnauthorizedError('Invalid or expired APPU request signature');
    }

    // 2. Validate request payload
    const parsed = saveStepRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid WhatsApp save-step request payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    // 3. Save step via domain service
    const result = await WhatsAppOnboardingService.saveStep(opts.db, parsed.data as any, {
      betaChatLimit: opts.betaChatLimit
    });

    return reply.status(200).send(result);
  });
};
