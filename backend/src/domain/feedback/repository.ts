import type { Queryable } from '../../db/types.js';
import type { FamilyFeedback, SubmitFeedbackInput } from './types.js';

interface FamilyFeedbackRow {
  id: string;
  household_id: string;
  rating: number;
  whats_working: string | null;
  whats_to_improve: string | null;
  created_at: Date;
}

function mapRow(row: FamilyFeedbackRow): FamilyFeedback {
  return {
    id: row.id,
    householdId: row.household_id,
    rating: Number(row.rating),
    whatsWorking: row.whats_working,
    whatsToImprove: row.whats_to_improve,
    createdAt: row.created_at
  };
}

export class FamilyFeedbackRepository {
  /**
   * Saves a new family feedback entry. Latest entry per household wins for report unlocking.
   */
  static async createFeedback(
    db: Queryable,
    householdId: string,
    input: SubmitFeedbackInput
  ): Promise<FamilyFeedback> {
    const res = await db.query<FamilyFeedbackRow>(
      `INSERT INTO family_feedback (household_id, rating, whats_working, whats_to_improve)
       VALUES ($1, $2, $3, $4)
       RETURNING id, household_id, rating, whats_working, whats_to_improve, created_at`,
      [
        householdId,
        input.rating,
        input.whatsWorking?.trim() || null,
        input.whatsToImprove?.trim() || null
      ]
    );

    return mapRow(res.rows[0]);
  }

  /**
   * Retrieves the most recent feedback submission for a household, or null if none exists.
   */
  static async getLatestFeedback(
    db: Queryable,
    householdId: string
  ): Promise<FamilyFeedback | null> {
    const res = await db.query<FamilyFeedbackRow>(
      `SELECT id, household_id, rating, whats_working, whats_to_improve, created_at
       FROM family_feedback
       WHERE household_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [householdId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return mapRow(res.rows[0]);
  }

  /**
   * Checks if at least one family feedback record exists for the household.
   */
  static async hasFamilyFeedback(
    db: Queryable,
    householdId: string
  ): Promise<boolean> {
    const res = await db.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM family_feedback WHERE household_id = $1
       ) AS exists`,
      [householdId]
    );

    return Boolean(res.rows[0]?.exists);
  }
}
