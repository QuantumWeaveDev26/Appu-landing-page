import type { Queryable, TransactionalQueryable } from '../../db/types.js';
import { QuotaExceededError, ForbiddenError, NotFoundError, IdempotencyConflictError } from '../../errors/index.js';
import type { Subscription, Plan } from '../subscription/types.js';
import type {
  UsageMetric,
  UsagePeriod,
  UsageSummary,
  ReserveUsageInput,
  UsageReservationResult,
  UsageRecord
} from './types.js';

interface UsageRecordRow {
  id: string;
  household_id: string;
  subscription_id: string;
  child_id: string | null;
  metric: UsageMetric;
  quantity: number;
  status: 'reserved' | 'committed' | 'released';
  period_start: Date | string;
  period_end: Date | string;
  idempotency_key: string | null;
  request_fingerprint: string | null;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

function mapUsageRecordRow(row: UsageRecordRow): UsageRecord {
  return {
    id: row.id,
    householdId: row.household_id,
    subscriptionId: row.subscription_id,
    childId: row.child_id,
    metric: row.metric,
    quantity: Number(row.quantity),
    status: row.status,
    periodStart: new Date(row.period_start),
    periodEnd: new Date(row.period_end),
    idempotencyKey: row.idempotency_key,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class UsageRepository {
  /**
   * Resolves the authoritative billing/usage period for a subscription.
   *
   * PERIOD INVARIANTS:
   * - Provider periods are authoritative ONLY if:
   *   1. Both currentPeriodStart and currentPeriodEnd are present and valid dates.
   *   2. currentPeriodStart < currentPeriodEnd.
   *   3. The period contains "now": currentPeriodStart <= now < currentPeriodEnd.
   * - If provider timestamps fail this invariant (e.g. future or expired period, or missing),
   *   source is strictly set to 'fallback' using a deterministic 30-day UTC cycle anchored at createdAt.
   *
   * @param subscription Subscription with timestamps
   * @param referenceTime Optional reference date (defaults to current time Date.now())
   */
  public static resolveUsagePeriod(
    subscription: {
      currentPeriodStart?: Date | null;
      currentPeriodEnd?: Date | null;
      createdAt: Date;
    },
    referenceTime: number | Date = Date.now()
  ): UsagePeriod {
    const now = typeof referenceTime === 'number' ? referenceTime : referenceTime.getTime();

    if (subscription.currentPeriodStart && subscription.currentPeriodEnd) {
      const pStart = new Date(subscription.currentPeriodStart).getTime();
      const pEnd = new Date(subscription.currentPeriodEnd).getTime();

      if (!isNaN(pStart) && !isNaN(pEnd) && pStart < pEnd && pStart <= now && now < pEnd) {
        return {
          startsAt: new Date(pStart),
          endsAt: new Date(pEnd),
          source: 'provider'
        };
      }
    }

    const cycleMs = 30 * 24 * 60 * 60 * 1000;
    const startAnchor = new Date(subscription.createdAt).getTime();

    if (isNaN(startAnchor) || now < startAnchor) {
      const safeAnchor = isNaN(startAnchor) ? now : startAnchor;
      return {
        startsAt: new Date(safeAnchor),
        endsAt: new Date(safeAnchor + cycleMs),
        source: 'fallback'
      };
    }

    const elapsedCycles = Math.floor((now - startAnchor) / cycleMs);
    const startsAt = new Date(startAnchor + elapsedCycles * cycleMs);
    const endsAt = new Date(startAnchor + (elapsedCycles + 1) * cycleMs);

    return { startsAt, endsAt, source: 'fallback' };
  }

  /**
   * Retrieves total consumed/reserved quantity for a given metric and period.
   */
  public static async getUsedQuantity(
    db: Queryable,
    householdId: string,
    subscriptionId: string,
    metric: UsageMetric,
    periodStart: Date,
    periodEnd: Date
  ): Promise<number> {
    const result = await db.query<{ total_used: string | number }>(
      `SELECT COALESCE(SUM(quantity), 0) AS total_used
       FROM usage_records
       WHERE household_id = $1
         AND subscription_id = $2
         AND metric = $3
         AND status IN ('committed', 'reserved')
         AND period_start = $4
         AND period_end = $5`,
      [householdId, subscriptionId, metric, periodStart.toISOString(), periodEnd.toISOString()]
    );

    const row = result.rows[0];
    return Number(row?.total_used ?? 0);
  }

  /**
   * Concurrency-safe atomic quota check and reservation inside a database transaction.
   * Serializes concurrent requests per household/subscription using PostgreSQL advisory transaction locks.
   */
  public static async reserveUsageAtomic(
    db: TransactionalQueryable,
    input: ReserveUsageInput
  ): Promise<UsageReservationResult> {
    // 1. Concurrency Serialization: Advisory transaction lock scoped to household + subscription
    // This serializes parallel reservation attempts for this household/subscription without table-level blocking.
    await db.query(
      `SELECT pg_advisory_xact_lock(hashtext('appu_usage_lock:' || $1 || ':' || $2))`,
      [input.householdId, input.subscriptionId]
    );

    // 2. Idempotency Check: if key provided, check if already recorded
    if (input.idempotencyKey && input.idempotencyKey.trim().length > 0) {
      const existingRes = await db.query<UsageRecordRow>(
        `SELECT * FROM usage_records
         WHERE household_id = $1 AND metric = $2 AND idempotency_key = $3`,
        [input.householdId, input.metric, input.idempotencyKey.trim()]
      );

      if (existingRes.rows.length > 0) {
        const existing = mapUsageRecordRow(existingRes.rows[0]);
        if (existing.status === 'committed' || existing.status === 'reserved') {
          // Fingerprint verification: reject if the same idempotency key
          // is reused for a logically different request.
          const storedFp = existingRes.rows[0].request_fingerprint;
          if (input.requestFingerprint && storedFp && storedFp !== input.requestFingerprint) {
            throw new IdempotencyConflictError(
              'Idempotency key has already been used for a different request. Use a new key for each distinct message.'
            );
          }
          return {
            reservationId: existing.id,
            isExisting: true,
            periodStart: existing.periodStart,
            periodEnd: existing.periodEnd,
            usedBeforeReservation: 0,
            remainingAfterReservation: 0
          };
        }
      }
    }

    // 3. Verify subscription status and period
    const subRes = await db.query<{
      id: string;
      status: string;
      current_period_start: Date | string | null;
      current_period_end: Date | string | null;
      created_at: Date | string;
    }>(
      `SELECT id, status, current_period_start, current_period_end, created_at
       FROM subscriptions
       WHERE id = $1 AND household_id = $2`,
      [input.subscriptionId, input.householdId]
    );

    if (subRes.rows.length === 0) {
      throw new NotFoundError('Subscription not found for this household');
    }

    const subRow = subRes.rows[0];
    if (subRow.status !== 'ACTIVE') {
      throw new ForbiddenError('An active subscription is required to consume AI sessions.');
    }

    // 4. Resolve exact billing period
    const period = this.resolveUsagePeriod({
      currentPeriodStart: subRow.current_period_start ? new Date(subRow.current_period_start) : null,
      currentPeriodEnd: subRow.current_period_end ? new Date(subRow.current_period_end) : null,
      createdAt: new Date(subRow.created_at)
    });

    // 5. Sum currently committed and active reservations in the current period
    const used = await this.getUsedQuantity(
      db,
      input.householdId,
      input.subscriptionId,
      input.metric,
      period.startsAt,
      period.endsAt
    );

    if (used + input.quantity > input.quotaLimit) {
      throw new QuotaExceededError(input.metric, input.quotaLimit, used);
    }

    // 6. Insert new reservation record
    const insertRes = await db.query<UsageRecordRow>(
      `INSERT INTO usage_records (
         household_id, subscription_id, child_id, metric, quantity, status,
         period_start, period_end, idempotency_key, request_fingerprint, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'reserved', $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        input.householdId,
        input.subscriptionId,
        input.childId ?? null,
        input.metric,
        input.quantity,
        period.startsAt.toISOString(),
        period.endsAt.toISOString(),
        input.idempotencyKey ?? null,
        input.requestFingerprint ?? null,
        JSON.stringify(input.metadata || {})
      ]
    );

    const record = mapUsageRecordRow(insertRes.rows[0]);

    return {
      reservationId: record.id,
      isExisting: false,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      usedBeforeReservation: used,
      remainingAfterReservation: Math.max(0, input.quotaLimit - (used + input.quantity))
    };
  }

  /**
   * Commits a reserved usage record upon successful upstream response.
   */
  public static async commitReservation(
    db: Queryable,
    householdId: string,
    reservationId: string
  ): Promise<boolean> {
    const res = await db.query(
      `UPDATE usage_records
       SET status = 'committed', updated_at = NOW()
       WHERE id = $1 AND household_id = $2 AND status = 'reserved'`,
      [reservationId, householdId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Concurrency-safe atomic voice usage recording and strict quota boundary enforcement.
   * Serializes parallel requests per household/subscription using PostgreSQL advisory transaction locks.
   *
   * STRICT BOUNDARY INVARIANT:
   * If measured duration > remaining monthly allowance:
   *   - delivered = false
   *   - record = null (0 usage charged)
   *   - audioSource must be omitted by the caller (text response only)
   */
  public static async recordVoiceUsageAtomic(
    db: TransactionalQueryable,
    input: {
      householdId: string;
      subscriptionId: string;
      childId?: string | null;
      durationMs: number;
      quotaLimitMs: number;
      idempotencyKey?: string | null;
      requestFingerprint?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    record: UsageRecord | null;
    delivered: boolean;
    remainingMs: number;
    isExisting: boolean;
  }> {
    if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
      return { record: null, delivered: false, remainingMs: 0, isExisting: false };
    }

    const durationMs = Math.round(input.durationMs);

    // 1. Concurrency Serialization: Advisory transaction lock scoped to household + subscription
    await db.query(
      `SELECT pg_advisory_xact_lock(hashtext('appu_usage_lock:' || $1 || ':' || $2))`,
      [input.householdId, input.subscriptionId]
    );

    // 2. Idempotency check: if key provided, check if already recorded
    if (input.idempotencyKey && input.idempotencyKey.trim().length > 0) {
      const existingRes = await db.query<UsageRecordRow>(
        `SELECT * FROM usage_records
         WHERE household_id = $1 AND metric = 'voice_duration_ms' AND idempotency_key = $2`,
        [input.householdId, input.idempotencyKey.trim()]
      );

      if (existingRes.rows.length > 0) {
        const storedFp = existingRes.rows[0].request_fingerprint;
        if (input.requestFingerprint && storedFp && storedFp !== input.requestFingerprint) {
          throw new IdempotencyConflictError(
            'Idempotency key has already been used for a different request. Use a new key for each distinct message.'
          );
        }
        const existing = mapUsageRecordRow(existingRes.rows[0]);
        return {
          record: existing,
          delivered: true,
          remainingMs: 0,
          isExisting: true
        };
      }
    }

    // 3. Fetch subscription & period
    const subRes = await db.query<{
      id: string;
      status: string;
      current_period_start: Date | string | null;
      current_period_end: Date | string | null;
      created_at: Date | string;
    }>(
      `SELECT id, status, current_period_start, current_period_end, created_at
       FROM subscriptions
       WHERE id = $1 AND household_id = $2`,
      [input.subscriptionId, input.householdId]
    );

    if (subRes.rows.length === 0) {
      throw new NotFoundError('Subscription not found for this household');
    }

    const subRow = subRes.rows[0];
    if (subRow.status !== 'ACTIVE') {
      return { record: null, delivered: false, remainingMs: 0, isExisting: false };
    }

    const period = this.resolveUsagePeriod({
      currentPeriodStart: subRow.current_period_start ? new Date(subRow.current_period_start) : null,
      currentPeriodEnd: subRow.current_period_end ? new Date(subRow.current_period_end) : null,
      createdAt: new Date(subRow.created_at)
    });

    // 4. Sum currently committed voice duration for this period
    const usedMs = await this.getUsedQuantity(
      db,
      input.householdId,
      input.subscriptionId,
      'voice_duration_ms',
      period.startsAt,
      period.endsAt
    );

    const remainingMs = Math.max(0, input.quotaLimitMs - usedMs);

    // 5. Strict Quota Boundary Check:
    // If measured audio duration exceeds remaining allowance, do NOT record and do NOT deliver audio.
    if (durationMs > remainingMs) {
      return {
        record: null,
        delivered: false,
        remainingMs,
        isExisting: false
      };
    }

    // 6. Insert committed voice duration record
    const insertRes = await db.query<UsageRecordRow>(
      `INSERT INTO usage_records (
         household_id, subscription_id, child_id, metric, quantity, status,
         period_start, period_end, idempotency_key, request_fingerprint, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, 'voice_duration_ms', $4, 'committed', $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        input.householdId,
        input.subscriptionId,
        input.childId ?? null,
        durationMs,
        period.startsAt.toISOString(),
        period.endsAt.toISOString(),
        input.idempotencyKey ?? null,
        input.requestFingerprint ?? null,
        JSON.stringify(input.metadata || {})
      ]
    );

    return {
      record: mapUsageRecordRow(insertRes.rows[0]),
      delivered: true,
      remainingMs: remainingMs - durationMs,
      isExisting: false
    };
  }

  /**
   * Releases a reserved usage record if upstream provider fails.
   */
  public static async releaseReservation(
    db: Queryable,
    householdId: string,
    reservationId: string
  ): Promise<boolean> {
    const res = await db.query(
      `UPDATE usage_records
       SET status = 'released', updated_at = NOW()
       WHERE id = $1 AND household_id = $2 AND status = 'reserved'`,
      [reservationId, householdId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Generates a display-safe usage summary for a household.
   */
  public static async getUsageSummary(
    db: Queryable,
    householdId: string,
    subscription: Subscription,
    plan: Plan
  ): Promise<UsageSummary> {
    const period = this.resolveUsagePeriod(subscription);

    const aiLimit = Number(plan.entitlements?.monthly_ai_sessions ?? 100);
    const voiceLimit = Number(plan.entitlements?.monthly_voice_minutes ?? 30);

    const aiUsed = await this.getUsedQuantity(
      db,
      householdId,
      subscription.id,
      'ai_sessions',
      period.startsAt,
      period.endsAt
    );

    const usedVoiceMs = await this.getUsedQuantity(
      db,
      householdId,
      subscription.id,
      'voice_duration_ms',
      period.startsAt,
      period.endsAt
    );

    const voiceMinutesUsed = Math.round((usedVoiceMs / 60000) * 10) / 10;
    const voiceMinutesRemaining = Math.max(0, Math.round((voiceLimit - voiceMinutesUsed) * 10) / 10);

    return {
      period: {
        startsAt: period.startsAt.toISOString(),
        endsAt: period.endsAt.toISOString(),
        source: period.source
      },
      aiSessions: {
        used: aiUsed,
        limit: aiLimit,
        remaining: Math.max(0, aiLimit - aiUsed)
      },
      voiceMinutes: {
        used: voiceMinutesUsed,
        limit: voiceLimit,
        remaining: voiceMinutesRemaining,
        meteringStatus: 'active'
      }
    };
  }
}
