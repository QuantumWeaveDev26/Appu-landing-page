import type { TransactionalQueryable } from '../../db/types.js';
import { GuestLimitReachedError, IdempotencyConflictError, NotFoundError } from '../../errors/index.js';
import { GuestRepository } from '../guest/repository.js';
import type { GuestSession } from '../guest/types.js';
import { UsageRepository } from '../usage/repository.js';
import type { UsageReservationResult } from '../usage/types.js';
import { AppuRequestRepository } from './repository.js';
import { AppuRequestStates, type AppuRequestRecord } from './types.js';

export class AppuRequestService {
  private static readonly processRequestTails = new Map<string, Promise<void>>();

  private static async withProcessRequestLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const predecessor = this.processRequestTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = predecessor.then(() => current);
    this.processRequestTails.set(key, tail);
    await predecessor;
    try {
      return await work();
    } finally {
      release();
      if (this.processRequestTails.get(key) === tail) {
        this.processRequestTails.delete(key);
      }
    }
  }

  public static async beginAuthenticated(
    db: TransactionalQueryable,
    input: {
      householdId: string;
      subscriptionId: string;
      childId: string;
      quotaLimit: number;
      idempotencyKey: string;
      requestFingerprint: string;
    }
  ): Promise<{
    request: AppuRequestRecord;
    reservation: UsageReservationResult;
    isExisting: boolean;
  }> {
    const processLockKey = `${input.householdId}:${input.idempotencyKey}`;
    return this.withProcessRequestLock(processLockKey, () => db.transaction(async (tx) => {
      // Serialize only the same tenant/idempotency key. This database lock survives
      // multiple backend processes and is held until request+reservation commit.
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext('appu_request:' || $1 || ':' || $2))`,
        [input.householdId, input.idempotencyKey]
      );

      const existing = await AppuRequestRepository.findAuthenticatedByIdempotencyKey(
        tx,
        input.householdId,
        input.idempotencyKey
      );
      if (existing) {
        if (existing.requestFingerprint !== input.requestFingerprint) {
          throw new IdempotencyConflictError(
            'Idempotency key has already been used for a different request'
          );
        }
        const usage = await tx.query<{ status: 'reserved' | 'committed' | 'released' }>(
          `SELECT status FROM usage_records
           WHERE id = $1 AND household_id = $2`,
          [existing.usageRecordId, input.householdId]
        );
        const status = usage.rows[0]?.status ?? 'reserved';
        return {
          request: existing,
          isExisting: true,
          reservation: {
            reservationId: existing.usageRecordId!,
            isExisting: true,
            status,
            periodStart: existing.createdAt,
            periodEnd: existing.createdAt,
            usedBeforeReservation: 0,
            remainingAfterReservation: 0
          }
        };
      }

      const reservation = await UsageRepository.reserveUsageAtomic(tx as TransactionalQueryable, {
        householdId: input.householdId,
        subscriptionId: input.subscriptionId,
        childId: input.childId,
        metric: 'ai_sessions',
        quantity: 1,
        quotaLimit: input.quotaLimit,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint
      });

      const request = await AppuRequestRepository.createAuthenticatedPending(tx, {
        householdId: input.householdId,
        subscriptionId: input.subscriptionId,
        usageRecordId: reservation.reservationId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint
      });

      return { request, reservation, isExisting: reservation.isExisting };
    }));
  }

  public static async beginGuest(
    db: TransactionalQueryable,
    input: {
      session: GuestSession;
      maxTurns: number;
      idempotencyKey: string;
      requestFingerprint: string;
    }
  ): Promise<{
    request: AppuRequestRecord;
    isExisting: boolean;
    used: number;
    remaining: number;
  }> {
    const processLockKey = `guest:${input.session.id}:${input.idempotencyKey}`;
    return this.withProcessRequestLock(processLockKey, () => db.transaction(async (tx) => {
      await tx.query(
        `SELECT pg_advisory_xact_lock(hashtext('appu_guest_request:' || $1 || ':' || $2))`,
        [input.session.id, input.idempotencyKey]
      );

      const existing = await AppuRequestRepository.findGuestByIdempotencyKey(
        tx,
        input.session.id,
        input.idempotencyKey
      );
      if (existing) {
        if (existing.requestFingerprint !== input.requestFingerprint) {
          throw new IdempotencyConflictError(
            'Idempotency key has already been used for a different request'
          );
        }
        const current = await tx.query<{ used_turns: number | string }>(
          'SELECT used_turns FROM guest_sessions WHERE id = $1',
          [input.session.id]
        );
        const used = Number(current.rows[0]?.used_turns ?? input.session.usedTurns);
        return {
          request: existing,
          isExisting: true,
          used,
          remaining: Math.max(0, input.maxTurns - used)
        };
      }

      const updated = await GuestRepository.reserveTurn(tx, input.session.id, input.maxTurns);
      if (!updated) {
        throw new GuestLimitReachedError();
      }
      const request = await AppuRequestRepository.createGuestPending(tx, {
        guestSessionId: input.session.id,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint
      });
      return {
        request,
        isExisting: false,
        used: updated.usedTurns,
        remaining: Math.max(0, input.maxTurns - updated.usedTurns)
      };
    }));
  }

  public static async reconcile(
    db: TransactionalQueryable,
    input: {
      requestId: string;
      outcome: 'SUCCEEDED' | 'DEFINITE_FAILURE';
      completedAt?: string | null;
      downstreamExecutionId?: string | null;
      failureCode?: string | null;
    }
  ): Promise<{ request: AppuRequestRecord; idempotent: boolean }> {
    return db.transaction(async (tx) => {
      const request = await AppuRequestRepository.getByIdForUpdate(tx, input.requestId);
      if (!request) throw new NotFoundError('APPU request not found');

      if (request.status === input.outcome) {
        return { request, idempotent: true };
      }
      if (
        request.status === AppuRequestStates.SUCCEEDED ||
        request.status === AppuRequestStates.DEFINITE_FAILURE
      ) {
        throw new IdempotencyConflictError('APPU request already has a different terminal outcome');
      }

      if (request.actorType === 'authenticated') {
        if (!request.householdId || !request.usageRecordId) {
          throw new Error('Authenticated APPU request is missing its usage reservation');
        }
        const usageStatus = input.outcome === AppuRequestStates.SUCCEEDED ? 'committed' : 'released';
        await tx.query(
          `UPDATE usage_records
           SET status = $3, updated_at = NOW()
           WHERE id = $1 AND household_id = $2 AND status = 'reserved'`,
          [request.usageRecordId, request.householdId, usageStatus]
        );
      } else if (input.outcome === AppuRequestStates.DEFINITE_FAILURE) {
        if (!request.guestSessionId) {
          throw new Error('Guest APPU request is missing its guest session');
        }
        await tx.query(
          `UPDATE guest_sessions
           SET used_turns = GREATEST(0, used_turns - 1), updated_at = NOW()
           WHERE id = $1`,
          [request.guestSessionId]
        );
      }

      const transitioned = await AppuRequestRepository.transition(
        tx,
        request.id,
        [AppuRequestStates.PENDING, AppuRequestStates.UNKNOWN],
        input.outcome,
        {
          completedAt: input.completedAt,
          downstreamExecutionId: input.downstreamExecutionId,
          failureCode: input.failureCode
        }
      );
      if (!transitioned) throw new Error('Failed to transition APPU request');
      return { request: transitioned, idempotent: false };
    });
  }
}
