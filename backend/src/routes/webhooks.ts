import type { FastifyPluginAsync } from 'fastify';
import type { TransactionalQueryable } from '../db/types.js';
import type { RazorpayClient } from '../domain/razorpay/types.js';
import { SubscriptionService } from '../domain/subscription/service.js';
import { UnauthorizedError } from '../errors/index.js';

export interface WebhookRouteOptions {
  db: TransactionalQueryable;
  razorpayClient: RazorpayClient;
}

export const webhooksRoutes: FastifyPluginAsync<WebhookRouteOptions> = async (fastify, opts) => {
  /**
   * POST /api/webhooks/razorpay
   * Handles incoming Razorpay subscription webhooks with HMAC signature verification and idempotency.
   */
  fastify.post('/api/webhooks/razorpay', async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;
    const eventIdHeader = request.headers['x-razorpay-event-id'] as string | undefined;

    const rawBody: string =
      (request as any).rawBody || (typeof request.body === 'string' ? request.body : JSON.stringify(request.body));

    if (!signature) {
      throw new UnauthorizedError('Missing X-Razorpay-Signature header');
    }

    const result = await SubscriptionService.processWebhook(opts.db, opts.razorpayClient, {
      rawBody,
      signature,
      eventIdHeader
    });

    return reply.status(200).send({
      received: true,
      status: result.status,
      eventType: result.eventType
    });
  });
};
