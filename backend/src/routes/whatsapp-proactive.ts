import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { ProactiveWhatsAppService } from '../domain/whatsapp/proactive/index.js';
import { BadRequestError, UnauthorizedError } from '../errors/index.js';

export interface WhatsAppProactiveRouteOptions {
  db: TransactionalQueryable;
  signingSecret: string;
  signatureMaxAgeSeconds?: number;
}

const proactiveRequestSchema = z
  .object({
    dryRun: z.boolean().optional().default(false),
    limit: z.number().int().min(1, 'limit must be at least 1').max(500, 'limit must be at most 500').optional().default(200)
  })
  .strict();

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

function verifyHmacAuth(request: FastifyRequest, opts: WhatsAppProactiveRouteOptions): void {
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
}

function parseRequestBody(request: FastifyRequest) {
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const parsed = proactiveRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError('Invalid proactive request payload', {
      errors: parsed.error.flatten().fieldErrors
    });
  }
  return parsed.data;
}

export const whatsappProactiveRoutes: FastifyPluginAsync<WhatsAppProactiveRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * POST /api/appu/whatsapp/proactive/weekly-digest
   * Generates weekly learning summary and focus areas for parents with granted WhatsApp consent.
   */
  fastify.post('/api/appu/whatsapp/proactive/weekly-digest', async (request, reply) => {
    verifyHmacAuth(request, opts);
    const { dryRun, limit } = parseRequestBody(request);

    try {
      const targets = await ProactiveWhatsAppService.generateWeeklyDigest(opts.db, { dryRun, limit });
      return reply.status(200).send({
        success: true,
        jobType: 'weekly-digest',
        generatedAt: new Date().toISOString(),
        count: targets.length,
        targets
      });
    } catch {
      // Fail-safe: internal error returns success=false rather than 500
      return reply.status(200).send({
        success: false,
        jobType: 'weekly-digest',
        generatedAt: new Date().toISOString(),
        count: 0,
        targets: []
      });
    }
  });

  /**
   * POST /api/appu/whatsapp/proactive/daily-tip
   * Generates daily age-adapted study tips for active learners with parent WhatsApp consent.
   */
  fastify.post('/api/appu/whatsapp/proactive/daily-tip', async (request, reply) => {
    verifyHmacAuth(request, opts);
    const { dryRun, limit } = parseRequestBody(request);

    try {
      const targets = await ProactiveWhatsAppService.generateDailyTip(opts.db, { dryRun, limit });
      return reply.status(200).send({
        success: true,
        jobType: 'daily-tip',
        generatedAt: new Date().toISOString(),
        count: targets.length,
        targets
      });
    } catch {
      return reply.status(200).send({
        success: false,
        jobType: 'daily-tip',
        generatedAt: new Date().toISOString(),
        count: 0,
        targets: []
      });
    }
  });

  /**
   * POST /api/appu/whatsapp/proactive/birthday-wishes
   * Generates birthday greetings for learners celebrating today in Indian Standard Time (Asia/Kolkata).
   */
  fastify.post('/api/appu/whatsapp/proactive/birthday-wishes', async (request, reply) => {
    verifyHmacAuth(request, opts);
    const { dryRun, limit } = parseRequestBody(request);

    try {
      const targets = await ProactiveWhatsAppService.generateBirthdayWishes(opts.db, { dryRun, limit });
      return reply.status(200).send({
        success: true,
        jobType: 'birthday-wishes',
        generatedAt: new Date().toISOString(),
        count: targets.length,
        targets
      });
    } catch {
      return reply.status(200).send({
        success: false,
        jobType: 'birthday-wishes',
        generatedAt: new Date().toISOString(),
        count: 0,
        targets: []
      });
    }
  });
};
