import type { Queryable } from '../../db/types.js';
import { AppuAudioStatuses, type AppuAudioAuthorizationRecord, type AppuAudioStatus } from './types.js';

interface AppuAudioAuthorizationRow {
  request_id: string;
  household_id: string | null;
  child_id: string | null;
  guest_session_id: string | null;
  approved_text: string;
  language: string;
  audio_status: AppuAudioStatus;
  stream_count: number;
  created_at: Date | string;
  expires_at: Date | string;
}

function mapRow(row: AppuAudioAuthorizationRow): AppuAudioAuthorizationRecord {
  return {
    requestId: row.request_id,
    householdId: row.household_id,
    childId: row.child_id,
    guestSessionId: row.guest_session_id || null,
    approvedText: row.approved_text,
    language: row.language,
    audioStatus: row.audio_status,
    streamCount: Number(row.stream_count || 0),
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at)
  };
}

export class AppuAudioAuthorizationRepository {
  /**
   * Creates a durable server-authorized audio record binding the request, household, child, and approved text.
   */
  public static async create(
    db: Queryable,
    input: {
      requestId: string;
      householdId: string;
      childId?: string | null;
      approvedText: string;
      language?: string;
      expiresAt?: Date;
    }
  ): Promise<AppuAudioAuthorizationRecord> {
    const expiresAt = input.expiresAt || new Date(Date.now() + 10 * 60 * 1000); // 10 minutes default
    const result = await db.query<AppuAudioAuthorizationRow>(
      `INSERT INTO appu_audio_authorizations (
         request_id, household_id, child_id, approved_text, language, audio_status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       ON CONFLICT (request_id) DO UPDATE SET
         approved_text = EXCLUDED.approved_text,
         language = EXCLUDED.language,
         expires_at = EXCLUDED.expires_at,
         audio_status = 'PENDING'
       RETURNING *`,
      [
        input.requestId,
        input.householdId,
        input.childId || null,
        input.approvedText,
        input.language || 'kn',
        expiresAt
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Creates a durable server-authorized audio record for a guest session.
   */
  public static async createForGuest(
    db: Queryable,
    input: {
      requestId: string;
      guestSessionId: string;
      approvedText: string;
      language?: string;
      expiresAt?: Date;
    }
  ): Promise<AppuAudioAuthorizationRecord> {
    const expiresAt = input.expiresAt || new Date(Date.now() + 10 * 60 * 1000);
    const result = await db.query<AppuAudioAuthorizationRow>(
      `INSERT INTO appu_audio_authorizations (
         request_id, guest_session_id, approved_text, language, audio_status, expires_at
       ) VALUES ($1, $2, $3, $4, 'PENDING', $5)
       ON CONFLICT (request_id) DO UPDATE SET
         approved_text = EXCLUDED.approved_text,
         language = EXCLUDED.language,
         expires_at = EXCLUDED.expires_at,
         audio_status = 'PENDING'
       RETURNING *`,
      [
        input.requestId,
        input.guestSessionId,
        input.approvedText,
        input.language || 'kn',
        expiresAt
      ]
    );
    return mapRow(result.rows[0]);
  }

  /**
   * Finds an authorized audio record by requestId.
   */
  public static async getById(
    db: Queryable,
    requestId: string
  ): Promise<AppuAudioAuthorizationRecord | null> {
    const result = await db.query<AppuAudioAuthorizationRow>(
      `SELECT * FROM appu_audio_authorizations WHERE request_id = $1`,
      [requestId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /**
   * Finds an authorized audio record strictly scoped to the requesting household and verifies not expired.
   */
  public static async findValidByHouseholdAndRequestId(
    db: Queryable,
    householdId: string,
    requestId: string
  ): Promise<{ record: AppuAudioAuthorizationRecord | null; isExpired: boolean; isWrongHousehold: boolean }> {
    const raw = await db.query<AppuAudioAuthorizationRow>(
      `SELECT * FROM appu_audio_authorizations WHERE request_id = $1`,
      [requestId]
    );

    if (!raw.rows[0]) {
      return { record: null, isExpired: false, isWrongHousehold: false };
    }

    const row = raw.rows[0];

    // Guest authorization accessed with household token → wrong principal
    if (row.guest_session_id && !row.household_id) {
      return { record: null, isExpired: false, isWrongHousehold: true };
    }

    if (row.household_id !== householdId) {
      return { record: null, isExpired: false, isWrongHousehold: true };
    }

    const record = mapRow(row);
    const isExpired = record.expiresAt.getTime() <= Date.now();

    if (isExpired) {
      return { record, isExpired: true, isWrongHousehold: false };
    }

    return { record, isExpired: false, isWrongHousehold: false };
  }

  /**
   * Finds an authorized audio record strictly scoped to the requesting guest session and verifies not expired.
   */
  public static async findValidByGuestAndRequestId(
    db: Queryable,
    guestSessionId: string,
    requestId: string
  ): Promise<{ record: AppuAudioAuthorizationRecord | null; isExpired: boolean; isWrongGuest: boolean }> {
    const raw = await db.query<AppuAudioAuthorizationRow>(
      `SELECT * FROM appu_audio_authorizations WHERE request_id = $1`,
      [requestId]
    );

    if (!raw.rows[0]) {
      return { record: null, isExpired: false, isWrongGuest: false };
    }

    const row = raw.rows[0];

    // Household authorization accessed with guest token → wrong principal
    if (row.household_id && !row.guest_session_id) {
      return { record: null, isExpired: false, isWrongGuest: true };
    }

    if (row.guest_session_id !== guestSessionId) {
      return { record: null, isExpired: false, isWrongGuest: true };
    }

    const record = mapRow(row);
    const isExpired = record.expiresAt.getTime() <= Date.now();

    if (isExpired) {
      return { record, isExpired: true, isWrongGuest: false };
    }

    return { record, isExpired: false, isWrongGuest: false };
  }

  /**
   * Deletes expired audio authorization records to ensure no indefinite retention of approved text.
   */
  public static async deleteExpired(db: Queryable): Promise<number> {
    const result = await db.query(
      `DELETE FROM appu_audio_authorizations WHERE expires_at < NOW()`
    );
    return result.rowCount || 0;
  }

  /**
   * Atomically transitions status to STREAMING and increments stream count if within replay limit.
   */
  public static async recordStreamStart(
    db: Queryable,
    requestId: string,
    maxReplays: number = 3
  ): Promise<{ allowed: boolean; streamCount: number }> {
    const result = await db.query<AppuAudioAuthorizationRow>(
      `UPDATE appu_audio_authorizations
       SET audio_status = 'STREAMING',
           stream_count = stream_count + 1
       WHERE request_id = $1 AND stream_count < $2
       RETURNING *`,
      [requestId, maxReplays]
    );

    if (!result.rows[0]) {
      return { allowed: false, streamCount: maxReplays };
    }

    return { allowed: true, streamCount: Number(result.rows[0].stream_count) };
  }

  /**
   * Transitions status to COMPLETED.
   */
  public static async recordStreamComplete(
    db: Queryable,
    requestId: string
  ): Promise<void> {
    await db.query(
      `UPDATE appu_audio_authorizations
       SET audio_status = 'COMPLETED'
       WHERE request_id = $1`,
      [requestId]
    );
  }
}
