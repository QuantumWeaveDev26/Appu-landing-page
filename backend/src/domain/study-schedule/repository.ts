import type { Queryable } from '../../db/types.js';
import type {
  StudyScheduleRecord,
  CreateStudyScheduleParams,
  ClaimPendingRemindersOptions,
  ClaimedStudyReminder
} from './types.js';

interface StudyScheduleRow {
  id: string;
  household_id: string;
  child_id: string;
  topic: string;
  scheduled_at: string | Date;
  time_display: string;
  raw_expression: string | null;
  reminder_sent: boolean;
  reminder_sent_at: string | Date | null;
  calendar_event_id: string | null;
  created_at: string | Date;
}

interface ClaimedReminderRow {
  id: string;
  household_id: string;
  child_id: string;
  child_name: string;
  parent_phone: string;
  topic: string;
  scheduled_at: string | Date;
  time_display: string;
  reminder_sent: boolean;
}

function mapRowToRecord(row: StudyScheduleRow): StudyScheduleRecord {
  return {
    id: row.id,
    householdId: row.household_id,
    childId: row.child_id,
    topic: row.topic,
    scheduledAt: new Date(row.scheduled_at),
    timeDisplay: row.time_display,
    rawExpression: row.raw_expression,
    reminderSent: row.reminder_sent,
    reminderSentAt: row.reminder_sent_at ? new Date(row.reminder_sent_at) : null,
    calendarEventId: row.calendar_event_id,
    createdAt: new Date(row.created_at)
  };
}

export class StudyScheduleRepository {
  /**
   * Creates a new study schedule record scoped to a household and child.
   */
  public static async create(
    db: Queryable,
    params: CreateStudyScheduleParams
  ): Promise<StudyScheduleRecord> {
    const query = `
      INSERT INTO study_schedules (
        household_id,
        child_id,
        topic,
        scheduled_at,
        time_display,
        raw_expression,
        calendar_event_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        household_id,
        child_id,
        topic,
        scheduled_at,
        time_display,
        raw_expression,
        reminder_sent,
        reminder_sent_at,
        calendar_event_id,
        created_at;
    `;

    const values = [
      params.householdId,
      params.childId,
      params.topic,
      params.scheduledAt,
      params.timeDisplay,
      params.rawExpression ?? null,
      params.calendarEventId ?? null
    ];

    const result = await db.query<StudyScheduleRow>(query, values);
    return mapRowToRecord(result.rows[0]);
  }

  /**
   * Atomically claims pending reminders within the upcoming time window using
   * a CTE with FOR UPDATE SKIP LOCKED to prevent duplicate reminder sends across concurrent workers.
   * If dryRun is true, rows are selected without updating reminder_sent or reminder_sent_at.
   */
  public static async claimPendingReminders(
    db: Queryable,
    options?: ClaimPendingRemindersOptions
  ): Promise<ClaimedStudyReminder[]> {
    const windowMinutes = options?.windowMinutes ?? 30;
    const limit = options?.limit ?? 200;
    const dryRun = options?.dryRun ?? false;
    const asOfDate = options?.asOfDate ?? new Date();

    const upperBound = new Date(asOfDate.getTime() + windowMinutes * 60 * 1000);
    const lowerBound = new Date(asOfDate.getTime() - 15 * 60 * 1000); // 15-minute lookback for edge cases

    const query = `
      WITH due_schedules AS (
        SELECT 
          s.id,
          COALESCE(c.nickname, c.preferred_name) AS child_name,
          h.parent_phone
        FROM study_schedules s
        JOIN households h ON h.id = s.household_id
        JOIN child_profiles c ON c.id = s.child_id
        WHERE s.reminder_sent = FALSE
          AND s.scheduled_at <= $1
          AND s.scheduled_at >= $2
          AND h.whatsapp_consent = TRUE
          AND h.parent_phone IS NOT NULL
          AND c.status = 'ACTIVE'
        ORDER BY s.scheduled_at ASC
        LIMIT $3
        FOR UPDATE OF s SKIP LOCKED
      ),
      claimed AS (
        UPDATE study_schedules s
        SET reminder_sent = CASE WHEN $4::boolean = TRUE THEN FALSE ELSE TRUE END,
            reminder_sent_at = CASE WHEN $4::boolean = TRUE THEN NULL ELSE NOW() END
        FROM due_schedules d
        WHERE s.id = d.id
        RETURNING s.id, s.household_id, s.child_id, s.topic, s.scheduled_at, s.time_display, s.reminder_sent
      )
      SELECT 
        c.id,
        c.household_id,
        c.child_id,
        d.child_name,
        d.parent_phone,
        c.topic,
        c.scheduled_at,
        c.time_display,
        c.reminder_sent
      FROM claimed c
      JOIN due_schedules d ON d.id = c.id;
    `;

    const values = [upperBound, lowerBound, limit, dryRun];
    const result = await db.query<ClaimedReminderRow>(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      householdId: row.household_id,
      childId: row.child_id,
      childName: row.child_name,
      parentPhone: row.parent_phone,
      topic: row.topic,
      scheduledAt: new Date(row.scheduled_at),
      timeDisplay: row.time_display,
      reminderSent: row.reminder_sent
    }));
  }

  /**
   * Retrieves upcoming study schedules for a specific child in a household, ordered by scheduled_at ascending.
   */
  public static async listUpcomingByChild(
    db: Queryable,
    householdId: string,
    childId: string,
    limit: number = 20
  ): Promise<StudyScheduleRecord[]> {
    const query = `
      SELECT
        id,
        household_id,
        child_id,
        topic,
        scheduled_at,
        time_display,
        raw_expression,
        reminder_sent,
        reminder_sent_at,
        calendar_event_id,
        created_at
      FROM study_schedules
      WHERE household_id = $1
        AND child_id = $2
        AND scheduled_at >= NOW()
      ORDER BY scheduled_at ASC
      LIMIT $3;
    `;

    const result = await db.query<StudyScheduleRow>(query, [householdId, childId, limit]);
    return result.rows.map(mapRowToRecord);
  }

  /**
   * Retrieves a single schedule record by household ID and schedule ID.
   */
  public static async findById(
    db: Queryable,
    householdId: string,
    scheduleId: string
  ): Promise<StudyScheduleRecord | null> {
    const query = `
      SELECT
        id,
        household_id,
        child_id,
        topic,
        scheduled_at,
        time_display,
        raw_expression,
        reminder_sent,
        reminder_sent_at,
        calendar_event_id,
        created_at
      FROM study_schedules
      WHERE household_id = $1 AND id = $2;
    `;

    const result = await db.query<StudyScheduleRow>(query, [householdId, scheduleId]);
    return result.rows.length > 0 ? mapRowToRecord(result.rows[0]) : null;
  }
}
