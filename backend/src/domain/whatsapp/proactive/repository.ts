import type { Queryable } from '../../../db/types.js';
import type {
  BirthdayTarget,
  EligibleHouseholdTarget,
  WeeklyActivityMetrics
} from './types.js';
import { isValidTopicTitle } from './generators.js';

interface EligibleHouseholdRow {
  household_id: string;
  parent_phone: string;
  child_id: string;
  preferred_name: string;
  nickname: string | null;
  grade_band: string;
  dob: Date | string | null;
  favorite_subjects: unknown;
}

interface BirthdayTargetRow {
  household_id: string;
  parent_phone: string;
  child_id: string;
  preferred_name: string;
  nickname: string | null;
  grade_band: string;
  dob: Date | string;
}

function formatDateString(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    return val.slice(0, 10);
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return null;
}

function computeEffectiveName(nickname: string | null | undefined, preferredName: string | null | undefined): string {
  if (nickname && nickname.trim().length > 0) {
    return nickname.trim();
  }
  if (preferredName && preferredName.trim().length > 0) {
    return preferredName.trim();
  }
  return 'learner';
}

function parseFavoriteSubjects(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  return [];
}

export class ProactiveWhatsAppRepository {
  /**
   * Retrieves all households that have opted in to WhatsApp automation with a valid phone number,
   * paired with their active child profile and personalization preferences.
   */
  public static async findEligibleHouseholds(db: Queryable): Promise<EligibleHouseholdTarget[]> {
    const result = await db.query<EligibleHouseholdRow>(
      `SELECT 
         h.id AS household_id,
         h.parent_phone,
         c.id AS child_id,
         c.preferred_name,
         c.nickname,
         c.grade_band,
         c.dob
       FROM households h
       JOIN child_profiles c ON c.household_id = h.id
       WHERE h.whatsapp_consent = TRUE
         AND h.parent_phone IS NOT NULL
         AND c.status = 'ACTIVE'
       ORDER BY h.id, c.created_at ASC;`
    );

    const targets: EligibleHouseholdTarget[] = [];
    for (const row of result.rows) {
      const personRes = await db.query<{ favorite_subjects: unknown }>(
        `SELECT favorite_subjects
         FROM child_personalisation
         WHERE household_id = $1 AND child_id = $2
         LIMIT 1;`,
        [row.household_id, row.child_id]
      );

      const favoriteSubjects = personRes.rows.length > 0
        ? parseFavoriteSubjects(personRes.rows[0].favorite_subjects)
        : [];

      targets.push({
        householdId: row.household_id,
        parentPhone: row.parent_phone,
        childId: row.child_id,
        preferredName: row.preferred_name,
        nickname: row.nickname ?? null,
        effectiveName: computeEffectiveName(row.nickname, row.preferred_name),
        gradeBand: row.grade_band,
        dob: formatDateString(row.dob),
        favoriteSubjects
      });
    }

    return targets;
  }

  /**
   * Calculates activity metrics for a specific child over a given time window (e.g. past 7 days).
   * Aggregates session count, user questions count, total message count, and recent topics.
   */
  public static async getWeeklyActivityMetrics(
    db: Queryable,
    householdId: string,
    childId: string,
    sinceDate: Date
  ): Promise<WeeklyActivityMetrics> {
    // 1. Fetch active sessions in time window
    const sessionRes = await db.query<{ id: string; title: string; updated_at: Date }>(
      `SELECT id, title, updated_at
       FROM conversation_sessions
       WHERE household_id = $1 AND child_id = $2
         AND updated_at >= $3
         AND expires_at > NOW()
       ORDER BY updated_at DESC;`,
      [householdId, childId, sinceDate]
    );

    // 2. Fetch message counts in time window
    const messageRes = await db.query<{
      total_count: string | number;
      user_question_count: string | number;
    }>(
      `SELECT 
         COUNT(*) AS total_count,
         COALESCE(SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END), 0) AS user_question_count
       FROM conversation_messages m
       JOIN conversation_sessions s ON s.id = m.conversation_id
       WHERE s.household_id = $1 AND s.child_id = $2
         AND m.created_at >= $3;`,
      [householdId, childId, sinceDate]
    );

    // 3. Fetch personalization favorite subjects
    const personRes = await db.query<{ favorite_subjects: unknown }>(
      `SELECT favorite_subjects
       FROM child_personalisation
       WHERE household_id = $1 AND child_id = $2;`,
      [householdId, childId]
    );

    const sessionCount = sessionRes.rows.length;
    const totalMessageCount = Number(messageRes.rows[0]?.total_count ?? 0);
    const userQuestionCount = Number(messageRes.rows[0]?.user_question_count ?? 0);

    // Deduplicate and filter plausible topics, up to 5
    const seenTopics = new Set<string>();
    const recentTopics: string[] = [];
    for (const session of sessionRes.rows) {
      const trimmed = (session.title ?? '').trim();
      if (isValidTopicTitle(trimmed) && !seenTopics.has(trimmed.toLowerCase())) {
        seenTopics.add(trimmed.toLowerCase());
        recentTopics.push(trimmed);
        if (recentTopics.length >= 5) break;
      }
    }

    const favoriteSubjects = personRes.rows.length > 0
      ? parseFavoriteSubjects(personRes.rows[0].favorite_subjects)
      : [];

    return {
      sessionCount,
      userQuestionCount,
      totalMessageCount,
      recentTopics,
      favoriteSubjects
    };
  }

  /**
   * Retrieves children who celebrate their birthday today in the Indian Standard Time (Asia/Kolkata) timezone,
   * belonging to households with active WhatsApp consent and a valid parent phone number.
   */
  public static async findBirthdayTargetsToday(
    db: Queryable,
    referenceDate: Date = new Date()
  ): Promise<BirthdayTarget[]> {
    // Resolve current day and month in Asia/Kolkata
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(referenceDate);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
    const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

    const result = await db.query<BirthdayTargetRow>(
      `SELECT 
         h.id AS household_id,
         h.parent_phone,
         c.id AS child_id,
         c.preferred_name,
         c.nickname,
         c.grade_band,
         c.dob
       FROM households h
       JOIN child_profiles c ON c.household_id = h.id
       WHERE h.whatsapp_consent = TRUE
         AND h.parent_phone IS NOT NULL
         AND c.status = 'ACTIVE'
         AND c.dob IS NOT NULL
         AND EXTRACT(MONTH FROM c.dob) = $1
         AND EXTRACT(DAY FROM c.dob) = $2
       ORDER BY h.id, c.created_at ASC;`,
      [month, day]
    );

    return result.rows.map((row) => ({
      householdId: row.household_id,
      parentPhone: row.parent_phone,
      childId: row.child_id,
      preferredName: row.preferred_name,
      nickname: row.nickname ?? null,
      effectiveName: computeEffectiveName(row.nickname, row.preferred_name),
      gradeBand: row.grade_band,
      dob: formatDateString(row.dob) ?? ''
    }));
  }

  /**
   * Finds candidate sessions for start and 30-minute study alerts:
   * - Households with whatsapp_consent = TRUE and non-null parent_phone
   * - Child profile is ACTIVE
   * - Either:
   *     a) Session started within last 8 min AND (no session_alerts row or start_sent_at IS NULL)
   *     b) Session started 30 to 40 min ago AND thirty_sent_at IS NULL
   */
  public static async findSessionAlertCandidates(
    db: Queryable,
    options?: { referenceDate?: Date; limit?: number }
  ): Promise<SessionAlertCandidateRow[]> {
    const now = options?.referenceDate ?? new Date();
    const startWindowMin = new Date(now.getTime() - 8 * 60 * 1000);
    const thirtyWindowMax = new Date(now.getTime() - 30 * 60 * 1000);
    const thirtyWindowMin = new Date(now.getTime() - 40 * 60 * 1000);
    const limit = options?.limit ?? 200;

    const result = await db.query<SessionAlertCandidateRow>(
      `SELECT 
         cs.id::text AS session_id,
         cs.household_id,
         cs.child_id,
         cs.created_at AS started_at,
         h.name AS household_name,
         h.parent_phone,
         c.preferred_name,
         c.nickname,
         sa.start_sent_at,
         sa.thirty_sent_at
       FROM conversation_sessions cs
       JOIN households h ON cs.household_id = h.id
       JOIN child_profiles c ON cs.child_id = c.id
       LEFT JOIN session_alerts sa ON sa.session_id = cs.id::text
       WHERE h.whatsapp_consent = TRUE
         AND h.parent_phone IS NOT NULL
         AND h.parent_phone != ''
         AND c.status = 'ACTIVE'
         AND (
           (cs.created_at >= $1 AND cs.created_at <= $2 AND sa.start_sent_at IS NULL)
           OR
           (cs.created_at >= $3 AND cs.created_at <= $4 AND sa.thirty_sent_at IS NULL)
         )
       ORDER BY cs.created_at DESC
       LIMIT $5;`,
      [startWindowMin, now, thirtyWindowMin, thirtyWindowMax, limit]
    );

    return result.rows;
  }

  /**
   * Records that a session alert ('start' or 'thirty') was emitted for a session,
   * deduping strictly via conditional update.
   */
  public static async recordSessionAlertSent(
    db: Queryable,
    alert: {
      sessionId: string;
      householdId: string;
      childId: string;
      startedAt: Date;
      alertType: 'start' | 'thirty';
      sentAt?: Date;
    }
  ): Promise<void> {
    const sentAt = alert.sentAt ?? new Date();
    if (alert.alertType === 'start') {
      await db.query(
        `INSERT INTO session_alerts (session_id, household_id, child_id, started_at, start_sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (session_id) DO UPDATE
         SET start_sent_at = EXCLUDED.start_sent_at
         WHERE session_alerts.start_sent_at IS NULL;`,
        [alert.sessionId, alert.householdId, alert.childId, alert.startedAt, sentAt]
      );
    } else if (alert.alertType === 'thirty') {
      await db.query(
        `INSERT INTO session_alerts (session_id, household_id, child_id, started_at, thirty_sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (session_id) DO UPDATE
         SET thirty_sent_at = EXCLUDED.thirty_sent_at
         WHERE session_alerts.thirty_sent_at IS NULL;`,
        [alert.sessionId, alert.householdId, alert.childId, alert.startedAt, sentAt]
      );
    }
  }
}

export interface SessionAlertCandidateRow {
  session_id: string;
  household_id: string;
  child_id: string;
  started_at: Date | string;
  household_name: string | null;
  parent_phone: string;
  preferred_name: string;
  nickname: string | null;
  start_sent_at: Date | string | null;
  thirty_sent_at: Date | string | null;
}
