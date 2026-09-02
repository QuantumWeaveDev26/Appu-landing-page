import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  BadRequestError,
  BadGatewayError,
  ServiceUnavailableError
} from '../errors/index.js';

const igrLeadSchema = z.object({
  user_name: z
    .string({ required_error: 'Parent / User Name is required' })
    .trim()
    .min(1, 'Parent / User Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters'),
  user_phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 characters')
    .max(25, 'Phone number cannot exceed 25 characters'),
  student_name: z
    .string()
    .trim()
    .max(100, 'Student name cannot exceed 100 characters')
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .max(150, 'Email cannot exceed 150 characters')
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Invalid email format'
    )
    .optional()
    .default(''),
  grade: z
    .string()
    .trim()
    .max(50, 'Grade cannot exceed 50 characters')
    .optional()
    .default('Class 10'),
  event_type: z
    .string()
    .trim()
    .max(50, 'Event type cannot exceed 50 characters')
    .optional()
    .default('DISCOVERY_CALL_BOOKING'),
  timestamp: z.string().optional()
});

export interface IgrLeadRouteOptions {
  leadWebhookUrl?: string;
}

export const igrLeadRoutes: FastifyPluginAsync<IgrLeadRouteOptions> = async (
  fastify,
  opts
) => {
  fastify.post('/api/igr/lead', async (request, reply) => {
    const parseResult = igrLeadSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new BadRequestError('Invalid lead payload', {
        errors: parseResult.error.flatten().fieldErrors
      });
    }

    const data = parseResult.data;
    const webhookUrl = opts.leadWebhookUrl || process.env.IGR_LEAD_WEBHOOK_URL;

    // Fail closed if webhook URL is not configured
    if (!webhookUrl || !webhookUrl.trim()) {
      fastify.log.warn(
        { grade: data.grade, eventType: data.event_type },
        '[IGR Lead] IGR_LEAD_WEBHOOK_URL is not configured on server'
      );
      throw new ServiceUnavailableError('Lead processing service is currently unconfigured.');
    }

    // Safe logging: log grade and event_type; NEVER log PII (user_phone / email / full names)
    fastify.log.info(
      {
        grade: data.grade,
        eventType: data.event_type
      },
      '[IGR Lead] Forwarding discovery call lead to upstream webhook'
    );

    const leadSummaryText = `NEW LEAD APPLICATION:\nParent Name: ${data.user_name}\nStudent Name: ${data.student_name || 'N/A'}\nPhone: ${data.user_phone}\nGrade: ${data.grade}\nEmail: ${data.email || 'N/A'}`;

    try {
      const n8nPayload = {
        action: 'sendMessage',
        chatInput: leadSummaryText,
        sessionId: 'lead_' + Date.now(),
        leadData: {
          user_name: data.user_name,
          user_phone: data.user_phone,
          student_name: data.student_name,
          email: data.email,
          grade: data.grade,
          event_type: data.event_type,
          timestamp: data.timestamp || new Date().toISOString()
        }
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        fastify.log.warn(
          { status: response.status },
          '[IGR Lead] Upstream lead webhook returned non-2xx status'
        );
        throw new BadGatewayError('Failed to deliver lead application to upstream processing service.');
      }

      return reply.status(200).send({
        success: true,
        message: 'Lead submission received successfully'
      });
    } catch (err: any) {
      if (err instanceof BadGatewayError || err instanceof ServiceUnavailableError) {
        throw err;
      }

      fastify.log.error(
        { err: err?.message || err },
        '[IGR Lead] Network error or timeout contacting upstream webhook'
      );
      throw new BadGatewayError('Upstream lead processing service did not respond.');
    }
  });
};
