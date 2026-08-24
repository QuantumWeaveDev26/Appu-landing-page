import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { AppuRequestService } from '../domain/appu-request/index.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/index.js';

export interface AppuCallbackRouteOptions {
  db: TransactionalQueryable;
  callbackSigningSecret: string;
  signatureMaxAgeSeconds?: number;
}

const callbackSchema = z.object({
  requestId: z.string().uuid(),
  outcome: z.enum(['SUCCEEDED', 'DEFINITE_FAILURE']),
  completedAt: z.string().datetime(),
  executionId: z.string().trim().min(1).max(255).optional(),
  failureCode: z.string().trim().min(1).max(100).optional()
}).strict();

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

export const appuCallbackRoutes: FastifyPluginAsync<AppuCallbackRouteOptions> = async (
  fastify,
  opts
) => {
  fastify.post('/api/internal/n8n/appu/callback', async (request, reply) => {
    const verification = verifyAppuHmacSignature({
      rawBody: rawBodyOf(request),
      timestampHeader: request.headers['x-appu-timestamp'] as string | undefined,
      signatureHeader: request.headers['x-appu-signature'] as string | undefined,
      secret: opts.callbackSigningSecret,
      maxAgeSeconds: opts.signatureMaxAgeSeconds
    });
    if (!verification.valid) {
      throw new UnauthorizedError('Invalid or expired APPU callback signature');
    }

    const parsed = callbackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid APPU callback payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const result = await AppuRequestService.reconcile(opts.db, {
      requestId: parsed.data.requestId,
      outcome: parsed.data.outcome,
      completedAt: parsed.data.completedAt,
      downstreamExecutionId: parsed.data.executionId,
      failureCode: parsed.data.failureCode
    });

    return reply.status(200).send({
      requestId: result.request.id,
      status: result.request.status,
      idempotent: result.idempotent
    });
  });
};
