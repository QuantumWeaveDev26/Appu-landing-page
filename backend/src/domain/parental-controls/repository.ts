import type { Queryable } from '../../db/types.js';
import type { SessionUsage, ParentSessionOtp } from './types.js';

function mapUsageRow(row: any): SessionUsage {
  return {
    sessionId: row.session_id,
    householdId: row.household_id,
    childId: row.child_id,
    activeSeconds: Number(row.active_seconds) || 0,
    awaySeconds: Number(row.away_seconds) || 0,
    windowStartedAt: new Date(row.window_started_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapOtpRow(row: any): ParentSessionOtp {
  return {
    id: row.id,
    householdId: row.household_id,
    childId: row.child_id,
    sessionId: row.session_id,
    codeHash: row.code_hash,
    expiresAt: new Date(row.expires_at),
    attempts: Number(row.attempts) || 0,
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
    createdAt: new Date(row.created_at)
  };
}

export class ParentalControlsRepository {
  /**
   * Incrementally accumulates active/away duration for the given session.
   */
  static async upsertHeartbeat(
    db: Queryable,
    sessionId: string,
    householdId: string,
    childId: string,
    addActiveSec: number,
    addAwaySec: number
  ): Promise<SessionUsage> {
    const res = await db.query(
      `INSERT INTO session_usage (session_id, household_id, child_id, active_seconds, away_seconds, window_started_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         active_seconds = session_usage.active_seconds + EXCLUDED.active_seconds,
         away_seconds = session_usage.away_seconds + EXCLUDED.away_seconds,
         updated_at = NOW()
       RETURNING session_id, household_id, child_id, active_seconds, away_seconds, window_started_at, updated_at`,
      [sessionId, householdId, childId, addActiveSec, addAwaySec]
    );
    return mapUsageRow(res.rows[0]);
  }

  /**
   * Retrieves current session usage metrics.
   */
  static async getSessionUsage(
    db: Queryable,
    sessionId: string,
    householdId: string,
    childId: string
  ): Promise<SessionUsage | null> {
    const res = await db.query(
      `SELECT session_id, household_id, child_id, active_seconds, away_seconds, window_started_at, updated_at
       FROM session_usage
       WHERE session_id = $1 AND household_id = $2 AND child_id = $3`,
      [sessionId, householdId, childId]
    );
    if (res.rows.length === 0) return null;
    return mapUsageRow(res.rows[0]);
  }

  /**
   * Resets the active/away counters and sets window_started_at to NOW().
   */
  static async resetUsageWindow(
    db: Queryable,
    sessionId: string,
    householdId: string,
    childId: string
  ): Promise<SessionUsage> {
    const res = await db.query(
      `INSERT INTO session_usage (session_id, household_id, child_id, active_seconds, away_seconds, window_started_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, NOW(), NOW())
       ON CONFLICT (session_id) DO UPDATE SET
         active_seconds = 0,
         away_seconds = 0,
         window_started_at = NOW(),
         updated_at = NOW()
       RETURNING session_id, household_id, child_id, active_seconds, away_seconds, window_started_at, updated_at`,
      [sessionId, householdId, childId]
    );
    return mapUsageRow(res.rows[0]);
  }

  /**
   * Inserts a new OTP challenge.
   */
  static async createOtp(
    db: Queryable,
    householdId: string,
    childId: string,
    sessionId: string,
    codeHash: string,
    expiresAt: Date
  ): Promise<ParentSessionOtp> {
    const res = await db.query(
      `INSERT INTO parent_session_otps (household_id, child_id, session_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, household_id, child_id, session_id, code_hash, expires_at, attempts, consumed_at, created_at`,
      [householdId, childId, sessionId, codeHash, expiresAt]
    );
    return mapOtpRow(res.rows[0]);
  }

  /**
   * Retrieves the most recent unconsumed OTP challenge for a session.
   */
  static async getLatestActiveOtp(
    db: Queryable,
    sessionId: string
  ): Promise<ParentSessionOtp | null> {
    const res = await db.query(
      `SELECT id, household_id, child_id, session_id, code_hash, expires_at, attempts, consumed_at, created_at
       FROM parent_session_otps
       WHERE session_id = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    if (res.rows.length === 0) return null;
    return mapOtpRow(res.rows[0]);
  }

  /**
   * Increments failed attempt count for an OTP challenge.
   */
  static async incrementOtpAttempts(
    db: Queryable,
    otpId: string
  ): Promise<number> {
    const res = await db.query<{ attempts: number }>(
      `UPDATE parent_session_otps
       SET attempts = attempts + 1
       WHERE id = $1
       RETURNING attempts`,
      [otpId]
    );
    return Number(res.rows[0]?.attempts) || 0;
  }

  /**
   * Marks an OTP challenge as consumed.
   */
  static async consumeOtp(
    db: Queryable,
    otpId: string
  ): Promise<void> {
    await db.query(
      `UPDATE parent_session_otps
       SET consumed_at = NOW()
       WHERE id = $1`,
      [otpId]
    );
  }

  /**
   * Counts OTP generation requests within a given timeframe for rate limiting.
   */
  static async countRecentOtps(
    db: Queryable,
    householdId: string,
    sessionId: string,
    since: Date
  ): Promise<number> {
    const res = await db.query<{ count: string | number }>(
      `SELECT COUNT(*) as count
       FROM parent_session_otps
       WHERE household_id = $1 AND session_id = $2 AND created_at >= $3`,
      [householdId, sessionId, since]
    );
    return Number(res.rows[0]?.count) || 0;
  }
}
