import type { FastifyPluginAsync } from 'fastify';
import type { TransactionalQueryable } from '../db/types.js';
import { SubscriptionRepository } from '../domain/subscription/repository.js';

export interface PlansRouteOptions {
  db: TransactionalQueryable;
}

export const plansRoutes: FastifyPluginAsync<PlansRouteOptions> = async (fastify, opts) => {
  /**
   * GET /api/plans
   * Public endpoint returning active plans with pricing and features.
   */
  fastify.get('/api/plans', async (_request, reply) => {
    const plans = await SubscriptionRepository.listActivePlans(opts.db);

    return reply.status(200).send({
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        currency: p.currency,
        amountPaise: p.amountPaise,
        displayPrice: `₹${(p.amountPaise / 100).toFixed(0)}/${p.billingInterval === 'monthly' ? 'mo' : 'yr'}`,
        billingInterval: p.billingInterval,
        entitlements: p.entitlements
      }))
    });
  });
};
