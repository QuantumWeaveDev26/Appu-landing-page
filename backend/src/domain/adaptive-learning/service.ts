import type { Queryable } from '../../db/types.js';
import { TenancyRepository } from '../tenancy/repository.js';

/**
 * Phase B (adaptive difficulty / persisted learner level) + Phase C
 * (out-of-syllabus curiosity tracking).
 *
 * All of this runs ONLY on requests carrying the experimental-learning flag
 * (develop). It is additive and never affects the standard answer path.
 */

// §8 decision-record vocabularies (the product validates the brain's codes).
export const CONCEPT_STATUSES = ['starting', 'practising', 'secure', 'mastered'] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export const REASON_CODES = [
  'NEW_TOPIC',
  'INDEPENDENT_SUCCESS',
  'TRANSFER_SUCCESS',
  'HINT_NEEDED',
  'PARTIAL',
  'MISCONCEPTION',
  'PREREQUISITE_GAP',
  'UNCLEAR'
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const NEXT_ACTIONS = [
  'stretch',
  'transfer',
  'similar_practice',
  'hint',
  'change_representation',
  'prerequisite',
  'delayed_recall',
  'diagnostic',
  'continue'
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export interface DecisionRecord {
  observed_result?: string;
  concept_status?: string;
  reason_code?: string;
  next_action?: string;
  assessed_level?: number;
  learner_message?: string;
}

export interface SyllabusStatus {
  in_syllabus?: boolean;
  topic?: string;
  expected_grade?: string | null;
}

export interface OutOfSyllabusEvent {
  topic: string;
  expectedGrade: string | null;
  createdAt: Date;
}

const LEVEL_MIN = 1;
const LEVEL_MAX = 5;

/**
 * Nudges the persisted working level toward the brain's assessed level for this
 * turn. Damped by sample count so a single lucky/unlucky turn can't swing it,
 * and clamped to 1..5. A learner's performance updates the level over time;
 * it is never a permanent label.
 */
export function nudgeLearnerLevel(
  current: number | null,
  samples: number,
  assessed: number
): { level: number; samples: number } {
  const target = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(assessed)));
  const priorSamples = Math.max(0, samples || 0);
  if (current === null || priorSamples <= 0) {
    return { level: target, samples: 1 };
  }
  // Weight of the new observation shrinks as evidence accumulates (floor 1/6).
  const weight = 1 / Math.min(priorSamples + 1, 6);
  const blended = current + (target - current) * weight;
  const level = Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(blended)));
  return { level, samples: priorSamples + 1 };
}

export function isValidReasonCode(code: unknown): code is ReasonCode {
  return typeof code === 'string' && (REASON_CODES as readonly string[]).includes(code);
}

export function isValidNextAction(action: unknown): action is NextAction {
  return typeof action === 'string' && (NEXT_ACTIONS as readonly string[]).includes(action);
}

export class AdaptiveLearningService {
  /**
   * Applies one turn's learning signals: nudges the child's working level from
   * the brain's assessed_level, and logs an out-of-syllabus event when the
   * question fell outside the child's grade. Fail-safe: any error is swallowed
   * so it can never break the answer path.
   */
  static async applyTurn(
    db: Queryable,
    householdId: string,
    childId: string,
    sessionId: string | null,
    decision: DecisionRecord | null | undefined,
    syllabus: SyllabusStatus | null | undefined,
    questionExcerpt: string | null
  ): Promise<void> {
    try {
      if (decision && typeof decision.assessed_level === 'number' && Number.isFinite(decision.assessed_level)) {
        const child = await TenancyRepository.getChildProfile(db, householdId, childId);
        if (child) {
          const { level, samples } = nudgeLearnerLevel(
            child.learnerLevel,
            child.learnerLevelSamples,
            decision.assessed_level
          );
          await TenancyRepository.updateChildProfile(db, householdId, childId, {
            learnerLevel: level,
            learnerLevelSamples: samples
          });
        }
      }

      if (syllabus && syllabus.in_syllabus === false && typeof syllabus.topic === 'string' && syllabus.topic.trim()) {
        await AdaptiveLearningService.recordOutOfSyllabusEvent(
          db,
          householdId,
          childId,
          sessionId,
          syllabus.topic.trim().slice(0, 200),
          questionExcerpt ? questionExcerpt.slice(0, 500) : null,
          syllabus.expected_grade ?? null
        );
      }
    } catch {
      // never throw from the learning pipeline
    }
  }

  static async recordOutOfSyllabusEvent(
    db: Queryable,
    householdId: string,
    childId: string,
    sessionId: string | null,
    topic: string,
    questionExcerpt: string | null,
    expectedGrade: string | null
  ): Promise<void> {
    await db.query(
      `INSERT INTO out_of_syllabus_events
         (household_id, child_id, session_id, topic, question_excerpt, expected_grade)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [householdId, childId, sessionId, topic, questionExcerpt, expectedGrade]
    );
  }

  /**
   * Off-syllabus topics the child explored recently, for the parent report's
   * positively-framed "Curiosity beyond syllabus" section.
   */
  static async listOutOfSyllabusEvents(
    db: Queryable,
    householdId: string,
    childId: string,
    sinceDays = 30,
    limit = 50
  ): Promise<OutOfSyllabusEvent[]> {
    const days = Math.max(1, Math.min(365, Math.round(sinceDays)));
    const result = await db.query<{ topic: string; expected_grade: string | null; created_at: Date | string }>(
      `SELECT topic, expected_grade, created_at
         FROM out_of_syllabus_events
        WHERE household_id = $1 AND child_id = $2
          AND created_at > NOW() - ($3 * INTERVAL '1 day')
        ORDER BY created_at DESC
        LIMIT $4;`,
      [householdId, childId, days, Math.max(1, Math.min(100, limit))]
    );
    return result.rows.map((r) => ({
      topic: r.topic,
      expectedGrade: r.expected_grade ?? null,
      createdAt: new Date(r.created_at)
    }));
  }
}
