import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { TransactionalQueryable } from '../db/types.js';
import { verifyAppuHmacSignature } from '../domain/gateway/index.js';
import { FamilyFeedbackService } from '../domain/feedback/index.js';
import { ReportService } from '../domain/report/index.js';
import { WhatsAppOnboardingRepository } from '../domain/whatsapp/onboarding/repository.js';
import { normalizePhoneNumber, TenancyRepository } from '../domain/tenancy/repository.js';
import { BadRequestError, UnauthorizedError } from '../errors/index.js';

export interface WhatsAppReportsRouteOptions {
  db: TransactionalQueryable;
  signingSecret: string;
  signatureMaxAgeSeconds?: number;
  openaiApiKey?: string;
  n8nFeedbackWebhookUrl?: string;
}

const submitFeedbackSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long'),
    rating: z
      .number({ required_error: 'Rating is required' })
      .int('Rating must be an integer')
      .min(1, 'Rating must be at least 1')
      .max(5, 'Rating must be at most 5'),
    whatsWorking: z
      .string({ required_error: "What's working is required" })
      .trim()
      .min(1, "What's working cannot be empty")
      .max(2000),
    whatsToImprove: z
      .string({ required_error: "What's to improve is required" })
      .trim()
      .min(1, "What's to improve cannot be empty")
      .max(2000)
  })
  .strict();

const sendReportSchema = z
  .object({
    phone: z
      .string({ required_error: 'Phone number is required' })
      .trim()
      .min(1, 'Phone number cannot be empty')
      .max(32, 'Phone number too long')
  })
  .strict();

function rawBodyOf(request: FastifyRequest): string {
  const rawBody = (request as FastifyRequest & { rawBody?: unknown }).rawBody;
  return typeof rawBody === 'string' ? rawBody : '';
}

function verifyHmac(request: FastifyRequest, opts: WhatsAppReportsRouteOptions): void {
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

export const whatsappReportsRoutes: FastifyPluginAsync<WhatsAppReportsRouteOptions> = async (
  fastify,
  opts
) => {
  /**
   * POST /api/appu/whatsapp/submit-feedback
   * Saves family feedback submitted via WhatsApp bot and unlocks child performance reports.
   * Authenticated strictly via HMAC-SHA256 signature.
   */
  fastify.post('/api/appu/whatsapp/submit-feedback', async (request, reply) => {
    verifyHmac(request, opts);

    const parsed = submitFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid WhatsApp submit feedback payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { phone, rating, whatsWorking, whatsToImprove } = parsed.data;

    let household = await WhatsAppOnboardingRepository.findHouseholdByPhone(opts.db, phone);
    if (!household) {
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        throw new BadRequestError('Invalid phone number format');
      }
      household = await WhatsAppOnboardingRepository.createPhoneOnlyHousehold(opts.db, normalized);
    }

    const result = await FamilyFeedbackService.saveFeedback(
      opts.db,
      household.id,
      {
        rating,
        whatsWorking,
        whatsToImprove
      },
      {
        source: 'whatsapp',
        webhookUrl: opts.n8nFeedbackWebhookUrl
      }
    );

    return reply.status(200).send({
      success: true,
      reportsUnlocked: true,
      householdId: household.id,
      feedback: result.feedback
    });
  });

  /**
   * POST /api/appu/whatsapp/send-report
   * Generates child performance report PDF for an inbound WhatsApp phone number.
   * GATED: Returns { feedbackRequired: true } if family feedback has not been submitted yet.
   * Authenticated strictly via HMAC-SHA256 signature.
   */
  fastify.post('/api/appu/whatsapp/send-report', async (request, reply) => {
    verifyHmac(request, opts);

    const parsed = sendReportSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new BadRequestError('Invalid WhatsApp send report payload', {
        errors: parsed.error.flatten().fieldErrors
      });
    }

    const { phone } = parsed.data;

    // 1. Resolve household by phone
    const household = await WhatsAppOnboardingRepository.findHouseholdByPhone(opts.db, phone);
    if (!household) {
      return reply.status(200).send({
        success: false,
        feedbackRequired: true,
        message: 'No registered household found for this phone number'
      });
    }

    // 2. Gate on family feedback
    const hasFeedback = await FamilyFeedbackService.hasFamilyFeedback(opts.db, household.id);
    if (!hasFeedback) {
      return reply.status(200).send({
        success: false,
        feedbackRequired: true,
        message: 'Parent feedback is required before generating report.'
      });
    }

    // 3. Resolve child profile
    const children = await TenancyRepository.listChildProfilesByHousehold(opts.db, household.id);
    if (!children || children.length === 0) {
      return reply.status(200).send({
        success: false,
        feedbackRequired: false,
        message: 'No child profile registered for this household'
      });
    }

    const child = children[0];

    // 4. Generate report PDF
    try {
      const { report, pdfBuffer, filename } = await ReportService.generateReportPdf(
        opts.db,
        household.id,
        child.id,
        { apiKey: opts.openaiApiKey }
      );

      return reply.status(200).send({
        success: true,
        feedbackRequired: false,
        childName: child.nickname || child.preferredName,
        filename,
        mimeType: 'application/pdf',
        pdfBase64: pdfBuffer.toString('base64'),
        documentSent: true
      });
    } catch (err: any) {
      return reply.status(200).send({
        success: false,
        feedbackRequired: false,
        message: err?.message || 'Failed to generate child performance report'
      });
    }
  });
};
