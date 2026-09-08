import type { Queryable } from '../../../db/types.js';
import type {
  BirthdayTarget,
  EligibleHouseholdTarget,
  WeeklyActivityMetrics
} from './types.js';

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
         c.dob,
         COALESCE(p.favorite_subjects, '[]'::jsonb) AS favorite_subjects
       FROM households h
       JOIN child_profiles c ON c.household_id = h.id
       LEFT JOIN child_personalisation p ON p.household_id = h.id AND p.child_id = c.id
       WHERE h.whatsapp_consent = TRUE
         AND h.parent_phone IS NOT NULL
         AND c.status = 'ACTIVE'
       ORDER BY h.id, c.created_at ASC;`
    );

    return result.rows.map((row) => ({
      householdId: row.household_id,
      parentPhone: row.parent_phone,
      childId: row.child_id,
      preferredName: row.preferred_name,
      nickname: row.nickname ?? null,
      effectiveName: computeEffectiveName(row.nickname, row.preferred_name),
      gradeBand: row.grade_band,
      dob: formatDateString(row.dob),
      favoriteSubjects: parseFavoriteSubjects(row.favorite_subjects)
    }));
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

    // Deduplicate and filter non-empty topics, up to 5
    const seenTopics = new Set<string>();
    const recentTopics: string[] = [];
    for (const session of sessionRes.rows) {
      const trimmed = (session.title ?? '').trim();
      if (trimmed.length > 0 && !seenTopics.has(trimmed.toLowerCase())) {
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
}
