import type { Queryable } from '../../db/types.js';
import { ForbiddenError, QuotaExceededError } from '../../errors/index.js';
import { SubscriptionRepository } from '../subscription/repository.js';
import { TenancyRepository } from '../tenancy/repository.js';
import type { EntitlementsMap } from './types.js';

export interface HouseholdEntitlementsContext {
  hasActiveSubscription: boolean;
  planCode: string | null;
  entitlements: EntitlementsMap | null;
}

/**
 * EntitlementEnforcementService enforces subscription-derived limits and capabilities.
 * Access sequence: verified parent -> household -> ACTIVE subscription -> server-resolved entitlements -> limit enforcement.
 */
export class EntitlementEnforcementService {
  /**
   * Derives active entitlements for a household.
   * SECURITY RULE: Paid entitlements are granted ONLY when subscription status is ACTIVE.
   */
  public static async getHouseholdEntitlements(
    db: Queryable,
    householdId: string
  ): Promise<HouseholdEntitlementsContext> {
    if (!householdId || typeof householdId !== 'string') {
      return {
        hasActiveSubscription: false,
        planCode: null,
        entitlements: null
      };
    }

    const subscription = await SubscriptionRepository.getLatestSubscriptionForHousehold(
      db,
      householdId.trim()
    );

    if (!subscription || subscription.status !== 'ACTIVE') {
      return {
        hasActiveSubscription: false,
        planCode: null,
        entitlements: null
      };
    }

    const plan = await SubscriptionRepository.getPlanById(db, subscription.planId);

    return {
      hasActiveSubscription: true,
      planCode: plan?.code ?? subscription.planCode ?? null,
      entitlements: plan?.entitlements ?? null
    };
  }

  /**
   * Enforces the `max_children` limit before creating a child profile.
   * Rejects requests if no active subscription exists or if the household has reached its plan quota.
   */
  public static async enforceChildCreationLimit(
    db: Queryable,
    householdId: string
  ): Promise<void> {
    const householdContext = await this.getHouseholdEntitlements(db, householdId);

    if (!householdContext.hasActiveSubscription) {
      throw new ForbiddenError(
        'An active subscription is required to add child profiles. Please subscribe to a plan.'
      );
    }

    const maxChildren = Number(householdContext.entitlements?.max_children ?? 1);
    const currentCount = await TenancyRepository.countChildProfilesByHousehold(db, householdId);

    if (currentCount >= maxChildren) {
      throw new QuotaExceededError('child_profiles', maxChildren, currentCount);
    }
  }
}
