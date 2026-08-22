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
      plans: plans.map((p) => {
        const isFree = p.amountPaise === 0;
        const isSignature = p.code === 'signature';
        const priceNum = Math.round(p.amountPaise / 100);
        let displayPrice: string;

        if (isFree) {
          displayPrice = '₹0';
        } else if (isSignature) {
          displayPrice = p.billingInterval === 'yearly' ? 'From ₹49,999/yr' : 'From ₹4,999/mo';
        } else {
          displayPrice = p.billingInterval === 'yearly'
            ? `₹${priceNum.toLocaleString('en-IN')}/yr`
            : `₹${priceNum.toLocaleString('en-IN')}/mo`;
        }

        return {
          code: p.code,
          tierCode: p.tierCode || p.code,
          tierName: p.tierName || p.name,
          name: p.name,
          description: p.description,
          currency: p.currency,
          amountPaise: p.amountPaise,
          displayPrice,
          billingInterval: p.billingInterval,
          annualSavingsPaise: p.annualSavingsPaise || 0,
          monthlyEquivalentPaise: p.monthlyEquivalentPaise || p.amountPaise,
          isPublic: p.isPublic !== undefined ? p.isPublic : true,
          isPrimaryCard: p.isPrimaryCard !== undefined ? p.isPrimaryCard : true,
          isRecommended: Boolean(p.isRecommended),
          checkoutEnabled: p.checkoutEnabled !== undefined ? p.checkoutEnabled : true,
          displayOrder: p.displayOrder || 0,
          ctaText: p.ctaText || (isFree ? 'Start Free' : isSignature ? 'Apply for Signature' : 'Choose Plan'),
          ctaAction: p.ctaAction || (isFree ? 'free_checkout' : isSignature ? 'apply' : 'checkout'),
          entitlements: p.entitlements
        };
      })
    });
  });
};
