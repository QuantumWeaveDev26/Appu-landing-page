import type { Queryable, TransactionalQueryable } from '../../db/types.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import { SubscriptionRepository } from '../subscription/repository.js';
import { UsageRepository } from './repository.js';
import type {
  UsageSummary,
  UsageReservationResult
} from './types.js';

export class UsageService {
  /**
   * Concurrency-safe reservation of 1 AI session before upstream provider execution.
   */
  public static async reserveAiSession(
    db: TransactionalQueryable,
    input: {
      householdId: string;
      subscriptionId: string;
      childId?: string | null;
      quotaLimit: number;
      idempotencyKey?: string | null;
      requestFingerprint?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<UsageReservationResult> {
    return UsageRepository.reserveUsageAtomic(db, {
      householdId: input.householdId,
      subscriptionId: input.subscriptionId,
      childId: input.childId,
      metric: 'ai_sessions',
      quantity: 1,
      quotaLimit: input.quotaLimit,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      metadata: input.metadata
    });
  }

  /**
   * Commits the AI session usage reservation upon successful provider response.
   */
  public static async commitAiSession(
    db: Queryable,
    householdId: string,
    reservationId: string
  ): Promise<void> {
    await UsageRepository.commitReservation(db, householdId, reservationId);
  }

  /**
   * Releases the AI session reservation if provider call fails or times out.
   */
  public static async releaseAiSession(
    db: Queryable,
    householdId: string,
    reservationId: string
  ): Promise<void> {
    await UsageRepository.releaseReservation(db, householdId, reservationId);
  }

  /**
   * Produces the authoritative usage summary for an authenticated parent's household.
   */
  public static async getHouseholdUsageSummary(
    db: Queryable,
    householdId: string
  ): Promise<UsageSummary> {
    const subscription = await SubscriptionRepository.getLatestSubscriptionForHousehold(
      db,
      householdId
    );

    if (!subscription || subscription.status !== 'ACTIVE') {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        period: {
          startsAt: now.toISOString(),
          endsAt: nextMonth.toISOString(),
          source: 'fallback'
        },
        aiSessions: {
          used: 0,
          limit: 0,
          remaining: 0
        },
        voiceMinutes: {
          used: null,
          limit: 0,
          remaining: null,
          meteringStatus: 'pending'
        }
      };
    }

    const plan = await SubscriptionRepository.getPlanById(db, subscription.planId);
    if (!plan) {
      throw new NotFoundError('Plan associated with active subscription not found');
    }

    return UsageRepository.getUsageSummary(db, householdId, subscription, plan);
  }
}
