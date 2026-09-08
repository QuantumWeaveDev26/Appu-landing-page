import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { StudyScheduleService } from '../domain/study-schedule/index.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/index.js';

export interface StudySchedulesRouteOptions {
  db: TransactionalQueryable;
  signingSecret: string;
  signatureMaxAgeSeconds?: number;
}

const recordScheduleSchema = z
  .object({
    phone: z.string({ required_error: 'phone is required' }).trim().min(1, 'phone cannot be empty'),
    topic: z.string({ required_error: 'topic is required' }).trim().min(1, 'topic cannot be empty').max(150, 'topic too long'),
    scheduledAt: z.string({ required_error: 'scheduledAt is required' }).trim().min(1, 'scheduledAt cannot be empty'),
    timeDisplay: z.string().trim().max(50).optional(),
    rawExpression: z.string().trim().max(150).optional()
  })
  .strict();

const proactiveRemindersSchema = z
  .object({
    dryRun: z.boolean().optional().default(false),
    limit: z.number().int().min(1, 'limit must be at least 1').max(500, 'limit must be at most 500').optional().default(200),
    windowMinutes: z.number().int().min(1, 'windowMinutes must be at least 1').max(1440, 'windowMinutes must be at most 1440').optional().default(30)
  })
  .strict();

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

function verifyHmacAuth(request: FastifyRequest, opts: StudySchedulesRouteOptions): void {
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

export const studySchedulesRoutes: FastifyPluginAsync<StudySchedulesRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * POST /api/appu/study-schedules
   * Records a study schedule intent captured from conversational interaction.
   */
  fastify.post('/api/appu/study-schedules', async (request, reply) => {
    verifyHmacAuth(request, opts);

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const parsed = recordScheduleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid study schedule request payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    try {
      const result = await StudyScheduleService.recordSchedule(opts.db, parsed.data);
      return reply.status(200).send({
        success: true,
        schedule: result.schedule,
        calendarUrl: result.calendarUrl
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof BadRequestError) {
        throw err;
      }
      throw err;
    }
  });

  /**
   * POST /api/appu/whatsapp/proactive/study-reminders
   * Proactive cron query claiming pending study reminders and formatting Meta template payloads.
   */
  fastify.post('/api/appu/whatsapp/proactive/study-reminders', async (request, reply) => {
    verifyHmacAuth(request, opts);

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const parsed = proactiveRemindersSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid proactive study reminders request payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { dryRun, limit, windowMinutes } = parsed.data;

    try {
      const targets = await StudyScheduleService.claimDueReminders(opts.db, {
        dryRun,
        limit,
        windowMinutes
      });
      return reply.status(200).send({
        success: true,
        jobType: 'study-reminders',
        generatedAt: new Date().toISOString(),
        count: targets.length,
        targets
      });
    } catch {
      // Fail-safe: internal error returns success=false rather than 500
      return reply.status(200).send({
        success: false,
        jobType: 'study-reminders',
        generatedAt: new Date().toISOString(),
        count: 0,
        targets: []
      });
    }
  });
};
