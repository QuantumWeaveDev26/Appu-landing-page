import type { Queryable } from '../../db/types.js';
import type { GuestSession } from './types.js';

export class GuestRepository {
  /**
   * Retrieves an active guest session by its ID.
   */
  public static async getById(
    db: Queryable,
    id: string
  ): Promise<GuestSession | null> {
    const result = await db.query(
      `SELECT id, ip_hash, used_turns, created_at, updated_at, expires_at
       FROM guest_sessions
       WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ipHash: row.ip_hash,
      usedTurns: Number(row.used_turns),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Upserts or creates a guest session with a specific ID, IP hash, and initial turns.
   */
  public static async upsert(
    db: Queryable,
    session: {
      id: string;
      ipHash: string;
      usedTurns: number;
      expiresAt: Date;
    }
  ): Promise<GuestSession> {
    const result = await db.query(
      `INSERT INTO guest_sessions (id, ip_hash, used_turns, created_at, updated_at, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4)
       ON CONFLICT (id) DO UPDATE
       SET used_turns = EXCLUDED.used_turns,
           updated_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at
       RETURNING id, ip_hash, used_turns, created_at, updated_at, expires_at`,
      [session.id, session.ipHash, session.usedTurns, session.expiresAt.toISOString()]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      ipHash: row.ip_hash,
      usedTurns: Number(row.used_turns),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Atomically reserves 1 guest turn only if current used_turns < maxTurns.
   * Prevents race conditions under concurrent requests.
   */
  public static async reserveTurn(
    db: Queryable,
    id: string,
    maxTurns = 3
  ): Promise<GuestSession | null> {
    const result = await db.query(
      `UPDATE guest_sessions
       SET used_turns = used_turns + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND used_turns < $2
       RETURNING id, ip_hash, used_turns, created_at, updated_at, expires_at`,
      [id, maxTurns]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ipHash: row.ip_hash,
      usedTurns: Number(row.used_turns),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Releases a reserved turn if upstream provider fails.
   */
  public static async releaseTurn(
    db: Queryable,
    id: string
  ): Promise<GuestSession | null> {
    const result = await db.query(
      `UPDATE guest_sessions
       SET used_turns = GREATEST(0, used_turns - 1),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, ip_hash, used_turns, created_at, updated_at, expires_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ipHash: row.ip_hash,
      usedTurns: Number(row.used_turns),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Atomically increments the used turns for a guest session by 1.
   */
  public static async incrementTurn(
    db: Queryable,
    id: string
  ): Promise<GuestSession | null> {
    const result = await db.query(
      `UPDATE guest_sessions
       SET used_turns = used_turns + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, ip_hash, used_turns, created_at, updated_at, expires_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      ipHash: row.ip_hash,
      usedTurns: Number(row.used_turns),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at)
    };
  }

  /**
   * Counts total turns used by an IP hash in the last specified hours (for abuse detection).
   */
  public static async countTurnsByIpHashSince(
    db: Queryable,
    ipHash: string,
    since: Date
  ): Promise<number> {
    const result = await db.query(
      `SELECT COALESCE(SUM(used_turns), 0) AS total_turns
       FROM guest_sessions
       WHERE ip_hash = $1 AND updated_at >= $2`,
      [ipHash, since.toISOString()]
    );

    return Number(result.rows[0]?.total_turns || 0);
  }
}
