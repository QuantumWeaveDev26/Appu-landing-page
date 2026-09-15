import type { Queryable } from '../../db/types.js';
import type { ReportEngagement } from './types.js';

const KNOWN_SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Social Studies',
  'Environmental Studies',
  'Hindi',
  'Kannada',
  'Physics',
  'Chemistry',
  'Biology',
  'History',
  'Geography',
  'Computer Science'
];

export class ReportAggregator {
  /**
   * Computes engagement metrics (totalChats, activeDays, topSubject) from conversation history.
   * Uses portable, database-agnostic calculation for activeDays.
   */
  static async computeEngagement(
    db: Queryable,
    householdId: string,
    childId: string,
    favoriteSubjects: string[] = []
  ): Promise<ReportEngagement> {
    const statsResult = await db.query<{
      session_id: string;
      created_at: Date | string | null;
    }>(
      `SELECT s.id AS session_id, m.created_at
       FROM conversation_sessions s
       LEFT JOIN conversation_messages m ON m.conversation_id = s.id
       WHERE s.child_id = $1 AND s.household_id = $2`,
      [childId, householdId]
    );

    const distinctSessions = new Set<string>();
    const distinctDates = new Set<string>();

    for (const row of statsResult.rows) {
      if (row.session_id) {
        distinctSessions.add(row.session_id);
      }
      if (row.created_at) {
        const dateStr =
          typeof row.created_at === 'string'
            ? row.created_at.slice(0, 10)
            : row.created_at.toISOString().slice(0, 10);
        distinctDates.add(dateStr);
      }
    }

    const totalChats = distinctSessions.size;
    const activeDays = distinctDates.size;

    // Determine top subject from session titles
    const titlesResult = await db.query<{ title: string }>(
      `SELECT title FROM conversation_sessions
       WHERE child_id = $1 AND household_id = $2
       ORDER BY updated_at DESC
       LIMIT 50`,
      [childId, householdId]
    );

    const subjectCounts = new Map<string, number>();

    for (const { title } of titlesResult.rows) {
      if (!title) continue;
      const lower = title.toLowerCase();
      for (const subj of KNOWN_SUBJECTS) {
        if (lower.includes(subj.toLowerCase())) {
          subjectCounts.set(subj, (subjectCounts.get(subj) || 0) + 1);
        }
      }
    }

    let topSubject: string | null = null;
    let highestCount = 0;
    for (const [subj, count] of subjectCounts.entries()) {
      if (count > highestCount) {
        highestCount = count;
        topSubject = subj;
      }
    }

    if (!topSubject) {
      topSubject =
        favoriteSubjects.length > 0 && favoriteSubjects[0]?.trim()
          ? favoriteSubjects[0].trim()
          : 'General Learning';
    }

    return {
      totalChats,
      activeDays,
      topSubject
    };
  }
}
