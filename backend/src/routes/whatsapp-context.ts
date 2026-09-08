import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { WhatsAppContextService } from '../domain/whatsapp/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/index.js';

export interface WhatsAppContextRouteOptions {
  db: TransactionalQueryable;
  signingSecret: string;
  signatureMaxAgeSeconds?: number;
}

const contextRequestSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long'),
    turnLimit: z
      .number()
      .int()
      .min(1, 'turnLimit must be at least 1')
      .max(20, 'turnLimit must be at most 20')
      .optional()
  })
  .strict();

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

export const whatsappContextRoutes: FastifyPluginAsync<WhatsAppContextRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * POST /api/appu/whatsapp/context
   * Secure, internal read-only endpoint resolving learner personalization and recent conversation history
   * for an inbound WhatsApp phone number. Authenticated strictly via HMAC-SHA256 signature.
   */
  fastify.post('/api/appu/whatsapp/context', async (request, reply) => {
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
    const parsed = contextRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid WhatsApp context request payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { phone, turnLimit } = parsed.data;

    // 3. Resolve context via domain service with fail-safe guarantee
    try {
      const result = await WhatsAppContextService.resolveContext(opts.db, phone, turnLimit);
      return reply.status(200).send(result);
    } catch {
      // Fail-safe: service error yields unrecognized rather than 500
      return reply.status(200).send({ recognized: false });
    }
  });
};
