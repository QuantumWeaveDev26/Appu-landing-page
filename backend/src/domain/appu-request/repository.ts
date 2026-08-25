import type { Queryable } from '../../db/types.js';
import { AppuRequestStates, type AppuRequestRecord, type AppuRequestState } from './types.js';

interface AppuRequestRow {
  id: string;
  actor_type: 'authenticated' | 'guest';
  household_id: string | null;
  subscription_id: string | null;
  guest_session_id: string | null;
  usage_record_id: string | null;
  idempotency_key: string;
  request_fingerprint: string;
  status: AppuRequestState;
  downstream_execution_id: string | null;
  failure_code: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function mapRow(row: AppuRequestRow): AppuRequestRecord {
  return {
    id: row.id,
    actorType: row.actor_type,
    householdId: row.household_id,
    subscriptionId: row.subscription_id,
    guestSessionId: row.guest_session_id,
    usageRecordId: row.usage_record_id,
    idempotencyKey: row.idempotency_key,
    requestFingerprint: row.request_fingerprint,
    status: row.status,
    downstreamExecutionId: row.downstream_execution_id,
    failureCode: row.failure_code,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class AppuRequestRepository {
  public static async findGuestByIdempotencyKey(
    db: Queryable,
    guestSessionId: string,
    idempotencyKey: string
  ): Promise<AppuRequestRecord | null> {
    const result = await db.query<AppuRequestRow>(
      `SELECT * FROM appu_requests
       WHERE actor_type = 'guest' AND guest_session_id = $1 AND idempotency_key = $2`,
      [guestSessionId, idempotencyKey]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public static async createGuestPending(
    db: Queryable,
    input: {
      guestSessionId: string;
      idempotencyKey: string;
      requestFingerprint: string;
    }
  ): Promise<AppuRequestRecord> {
    const result = await db.query<AppuRequestRow>(
      `INSERT INTO appu_requests (
         actor_type, guest_session_id, idempotency_key, request_fingerprint, status
       ) VALUES ('guest', $1, $2, $3, 'PENDING')
       RETURNING *`,
      [input.guestSessionId, input.idempotencyKey, input.requestFingerprint]
    );
    return mapRow(result.rows[0]);
  }

  public static async findAuthenticatedByIdempotencyKey(
    db: Queryable,
    householdId: string,
    idempotencyKey: string
  ): Promise<AppuRequestRecord | null> {
    const result = await db.query<AppuRequestRow>(
      `SELECT * FROM appu_requests
       WHERE actor_type = 'authenticated' AND household_id = $1 AND idempotency_key = $2`,
      [householdId, idempotencyKey]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public static async createAuthenticatedPending(
    db: Queryable,
    input: {
      householdId: string;
      subscriptionId: string;
      usageRecordId: string;
      idempotencyKey: string;
      requestFingerprint: string;
    }
  ): Promise<AppuRequestRecord> {
    const result = await db.query<AppuRequestRow>(
      `INSERT INTO appu_requests (
         actor_type, household_id, subscription_id, usage_record_id,
         idempotency_key, request_fingerprint, status
       ) VALUES ('authenticated', $1, $2, $3, $4, $5, 'PENDING')
       RETURNING *`,
      [
        input.householdId,
        input.subscriptionId,
        input.usageRecordId,
        input.idempotencyKey,
        input.requestFingerprint
      ]
    );
    return mapRow(result.rows[0]);
  }

  public static async getById(db: Queryable, requestId: string): Promise<AppuRequestRecord | null> {
    const result = await db.query<AppuRequestRow>(
      'SELECT * FROM appu_requests WHERE id = $1',
      [requestId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public static async getByIdForUpdate(
    db: Queryable,
    requestId: string
  ): Promise<AppuRequestRecord | null> {
    const result = await db.query<AppuRequestRow>(
      'SELECT * FROM appu_requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public static async transition(
    db: Queryable,
    requestId: string,
    fromStates: AppuRequestState[],
    toState: AppuRequestState,
    metadata?: {
      completedAt?: string | null;
      downstreamExecutionId?: string | null;
      failureCode?: string | null;
    }
  ): Promise<AppuRequestRecord | null> {
    const isTerminal =
      toState === AppuRequestStates.SUCCEEDED || toState === AppuRequestStates.DEFINITE_FAILURE;
    const completedAtDate = metadata?.completedAt
      ? new Date(metadata.completedAt)
      : (isTerminal ? new Date() : null);

    const result = await db.query<AppuRequestRow>(
      `UPDATE appu_requests
       SET status = $2,
           downstream_execution_id = COALESCE($3, downstream_execution_id),
           failure_code = COALESCE($4, failure_code),
           completed_at = COALESCE($5, completed_at),
           updated_at = NOW()
       WHERE id = $1 AND status = ANY($6)
       RETURNING *`,
      [
        requestId,
        toState,
        metadata?.downstreamExecutionId ?? null,
        metadata?.failureCode ?? null,
        completedAtDate,
        fromStates
      ]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
