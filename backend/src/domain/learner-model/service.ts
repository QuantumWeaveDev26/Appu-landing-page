import type { Queryable } from '../../db/types.js';

/**
 * The measured learner model behind APPU's personalised teaching.
 *
 * Evidence = graded answers (chat quizzes, lesson quizzes, flashcard self-checks) and which
 * lesson modes the child opens. From it we keep a per-topic mastery record and build a short
 * note the brain reads before answering, so it teaches each child differently.
 * Nothing is recorded unless a parent has switched learning tracking on for that child.
 */

export const LEARNING_POLICY_VERSION = '2026-11-26';

export const EVENT_SOURCES = ['chat_quiz', 'lesson_quiz', 'flashcard', 'mode_open'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const LESSON_MODES = ['see', 'quiz', 'cards', 'diagram', 'notes', 'audio', 'voice', 'call'] as const;
export type LessonMode = (typeof LESSON_MODES)[number];

export type MasteryStatus = 'starting' | 'practising' | 'secure' | 'mastered';

export interface LearningEventInput {
  source: EventSource;
  topic: string;
  isCorrect?: boolean | null;
  mode?: LessonMode | null;
  question?: string | null;
}

export interface TopicMastery {
  topicKey: string;
  topic: string;
  attempts: number;
  correct: number;
  recent: string; // newest last, '1' = right, '0' = wrong, at most RECENT_WINDOW long
  status: MasteryStatus;
  lastMistake: string | null;
  lastSeenAt: Date;
  nextReviewAt: Date | null;
}

export interface LearnerModel {
  gradedAnswers: number;
  recentAccuracy: number | null; // 0..1 over the last RECENT_WINDOW answers of every topic
  needsPractice: TopicMastery[];
  strong: TopicMastery[];
  dueForReview: TopicMastery[];
  learnsBestWith: string[]; // plain words, most used first
}

const RECENT_WINDOW = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DAYS: Record<MasteryStatus, number> = { starting: 1, practising: 1, secure: 3, mastered: 7 };

/** Stable key for a topic name ("  Photosynthesis! " and "photosynthesis" are the same topic). */
export function topicKey(topic: string): string {
  return topic
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 80);
}

const accuracyOf = (recent: string) =>
  recent.length ? recent.split('').filter((c) => c === '1').length / recent.length : 0;

/** Mastery from the recent results: a single answer never makes a topic secure or weak. */
export function statusFor(recent: string): MasteryStatus {
  if (recent.length < 2) return 'starting';
  const acc = accuracyOf(recent);
  if (recent.length >= 5 && acc >= 0.85 && recent.endsWith('111')) return 'mastered';
  // One slip after a long good run keeps a topic secure; with little evidence it means practice.
  if (acc >= 0.7 && (recent.endsWith('1') || recent.length >= 5)) return 'secure';
  return 'practising';
}

/** Applies one graded answer to a topic's record (pure; used by recordEvents and tests). */
export function applyAnswer(
  prev: Pick<TopicMastery, 'attempts' | 'correct' | 'recent' | 'lastMistake'> | null,
  isCorrect: boolean,
  question: string | null,
  now: Date
): Pick<TopicMastery, 'attempts' | 'correct' | 'recent' | 'status' | 'lastMistake' | 'nextReviewAt'> {
  const recent = `${prev?.recent ?? ''}${isCorrect ? '1' : '0'}`.slice(-RECENT_WINDOW);
  const status = statusFor(recent);
  return {
    attempts: (prev?.attempts ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (isCorrect ? 1 : 0),
    recent,
    status,
    lastMistake: isCorrect ? (prev?.lastMistake ?? null) : (question?.trim().slice(0, 200) || prev?.lastMistake || null),
    nextReviewAt: new Date(now.getTime() + REVIEW_DAYS[status] * DAY_MS)
  };
}

const MODE_WORDS: Record<LessonMode, string> = {
  see: 'pictures and step-by-step visuals',
  diagram: 'pictures and step-by-step visuals',
  quiz: 'practice questions',
  cards: 'practice questions',
  audio: 'listening and talking',
  voice: 'listening and talking',
  call: 'listening and talking',
  notes: 'reading short notes'
};

interface MasteryRow {
  topic_key: string;
  topic: string;
  attempts: number | string;
  correct: number | string;
  recent: string;
  status: MasteryStatus;
  last_mistake: string | null;
  last_seen_at: Date | string;
  next_review_at: Date | string | null;
}

const toMastery = (r: MasteryRow): TopicMastery => ({
  topicKey: r.topic_key,
  topic: r.topic,
  attempts: Number(r.attempts),
  correct: Number(r.correct),
  recent: r.recent || '',
  status: r.status,
  lastMistake: r.last_mistake,
  lastSeenAt: new Date(r.last_seen_at),
  nextReviewAt: r.next_review_at ? new Date(r.next_review_at) : null
});

export class LearnerModelService {
  /** The parent's recorded decision, or null if they have not decided yet. */
  static async getDecision(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<{ granted: boolean; decidedAt: Date; policyVersion: string } | null> {
    const res = await db.query<{ granted: boolean; granted_at: Date | string; policy_version: string }>(
      `SELECT granted, granted_at, policy_version FROM child_learning_consent WHERE household_id = $1 AND child_id = $2`,
      [householdId, childId]
    );
    const row = res.rows[0];
    return row ? { granted: row.granted === true, decidedAt: new Date(row.granted_at), policyVersion: row.policy_version } : null;
  }

  /** Consent that allows recording: only an explicit, saved "yes". */
  static async getConsent(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<{ grantedAt: Date; policyVersion: string } | null> {
    const d = await LearnerModelService.getDecision(db, householdId, childId);
    return d && d.granted ? { grantedAt: d.decidedAt, policyVersion: d.policyVersion } : null;
  }

  /** Switches learning tracking on, or off. Switching off deletes everything recorded for the child. */
  static async setConsent(
    db: Queryable,
    householdId: string,
    childId: string,
    userId: string,
    granted: boolean
  ): Promise<void> {
    if (!granted) {
      for (const table of ['learner_topic_mastery', 'learning_events']) {
        await db.query(`DELETE FROM ${table} WHERE household_id = $1 AND child_id = $2`, [householdId, childId]);
      }
    }
    await db.query(
      `INSERT INTO child_learning_consent (household_id, child_id, granted, granted_by_user_id, policy_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (household_id, child_id) DO UPDATE
         SET granted = EXCLUDED.granted, granted_by_user_id = EXCLUDED.granted_by_user_id,
             policy_version = EXCLUDED.policy_version, granted_at = NOW()`,
      [householdId, childId, granted, userId, LEARNING_POLICY_VERSION]
    );
  }

  /** Records evidence for a consented child. Returns how many events were stored (0 without consent). */
  static async recordEvents(
    db: Queryable,
    householdId: string,
    childId: string,
    events: LearningEventInput[],
    now: Date = new Date()
  ): Promise<number> {
    if (!(await LearnerModelService.getConsent(db, householdId, childId))) return 0;
    let stored = 0;
    for (const e of events) {
      const topic = e.topic.trim().slice(0, 120);
      const key = topicKey(topic);
      if (!key) continue;
      const graded = e.source !== 'mode_open' && typeof e.isCorrect === 'boolean';
      await db.query(
        `INSERT INTO learning_events (household_id, child_id, source, topic_key, topic, is_correct, mode, question, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [householdId, childId, e.source, key, topic, graded ? e.isCorrect : null, e.mode ?? null,
         e.question?.trim().slice(0, 300) || null, now]
      );
      stored++;
      if (!graded) continue;

      const prevRes = await db.query<MasteryRow>(
        `SELECT topic_key, topic, attempts, correct, recent, status, last_mistake, last_seen_at, next_review_at
         FROM learner_topic_mastery WHERE household_id = $1 AND child_id = $2 AND topic_key = $3`,
        [householdId, childId, key]
      );
      const prev = prevRes.rows[0] ? toMastery(prevRes.rows[0]) : null;
      const next = applyAnswer(prev, e.isCorrect as boolean, e.question ?? null, now);
      if (prev) {
        await db.query(
          `UPDATE learner_topic_mastery
           SET attempts = $4, correct = $5, recent = $6, status = $7, last_mistake = $8, last_seen_at = $9, next_review_at = $10
           WHERE household_id = $1 AND child_id = $2 AND topic_key = $3`,
          [householdId, childId, key, next.attempts, next.correct, next.recent, next.status, next.lastMistake, now, next.nextReviewAt]
        );
      } else {
        await db.query(
          `INSERT INTO learner_topic_mastery
             (household_id, child_id, topic_key, topic, attempts, correct, recent, status, last_mistake, first_seen_at, last_seen_at, next_review_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11)`,
          [householdId, childId, key, topic, next.attempts, next.correct, next.recent, next.status, next.lastMistake, now, next.nextReviewAt]
        );
      }
    }
    return stored;
  }

  static async listTopics(db: Queryable, householdId: string, childId: string): Promise<TopicMastery[]> {
    const res = await db.query<MasteryRow>(
      `SELECT topic_key, topic, attempts, correct, recent, status, last_mistake, last_seen_at, next_review_at
       FROM learner_topic_mastery WHERE household_id = $1 AND child_id = $2
       ORDER BY last_seen_at DESC LIMIT 200`,
      [householdId, childId]
    );
    return res.rows.map(toMastery);
  }

  static async buildModel(db: Queryable, householdId: string, childId: string, now: Date = new Date()): Promise<LearnerModel> {
    const topics = await LearnerModelService.listTopics(db, householdId, childId);
    const modes = await db.query<{ mode: LessonMode; n: number | string }>(
      `SELECT mode, COUNT(*) AS n FROM learning_events
       WHERE household_id = $1 AND child_id = $2 AND source = 'mode_open' AND mode IS NOT NULL
         AND created_at > $3
       GROUP BY mode`,
      [householdId, childId, new Date(now.getTime() - 60 * DAY_MS)]
    );
    return LearnerModelService.summarise(topics, modes.rows.map((r) => ({ mode: r.mode, n: Number(r.n) })), now);
  }

  /** Pure: picks what the brain needs to know from the topic records and mode counts. */
  static summarise(topics: TopicMastery[], modes: { mode: LessonMode; n: number }[], now: Date): LearnerModel {
    const allRecent = topics.map((t) => t.recent).join('');
    const words = new Map<string, number>();
    for (const { mode, n } of modes) {
      const w = MODE_WORDS[mode];
      if (w) words.set(w, (words.get(w) ?? 0) + n);
    }
    const weakFirst = (a: TopicMastery, b: TopicMastery) => accuracyOf(a.recent) - accuracyOf(b.recent);
    return {
      gradedAnswers: topics.reduce((s, t) => s + t.attempts, 0),
      recentAccuracy: allRecent.length ? accuracyOf(allRecent) : null,
      needsPractice: topics.filter((t) => t.status === 'practising').sort(weakFirst).slice(0, 4),
      strong: topics.filter((t) => t.status === 'secure' || t.status === 'mastered').slice(0, 5),
      dueForReview: topics
        .filter((t) => t.status !== 'starting' && t.nextReviewAt && t.nextReviewAt <= now)
        .slice(0, 2),
      learnsBestWith: [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w)
    };
  }

  /** The note given to the brain with the learner's message. Empty when there is nothing measured yet. */
  static promptNote(model: LearnerModel): string {
    const lines: string[] = [];
    const score = (t: TopicMastery) => `${t.recent.split('').filter((c) => c === '1').length} of ${t.recent.length} right`;
    if (model.needsPractice.length) {
      lines.push(
        `- Needs practice: ${model.needsPractice
          .map((t) => `${t.topic} (${score(t)}${t.lastMistake ? `; missed: "${t.lastMistake}"` : ''})`)
          .join('; ')}`
      );
    }
    if (model.strong.length) lines.push(`- Secure or mastered: ${model.strong.map((t) => t.topic).join(', ')}`);
    if (model.dueForReview.length) lines.push(`- Due for a quick review: ${model.dueForReview.map((t) => t.topic).join(', ')}`);
    if (model.learnsBestWith.length) lines.push(`- Learns best with: ${model.learnsBestWith.join(', then ')}`);
    if (model.recentAccuracy !== null) {
      lines.push(`- Recent accuracy: ${Math.round(model.recentAccuracy * 100)}% over the last graded answers`);
    }
    if (!lines.length) return '';
    return [
      "LEARNER MODEL (measured by APPU from this learner's own graded answers and choices; use it silently, never read it out or mention scores unless asked):",
      ...lines,
      'HOW TO ADAPT THIS ANSWER:',
      '- Question on a "needs practice" topic: go one step simpler, explain it a different way than before (real-life example, picture in words), address the missed idea, then check with one quick question.',
      '- Question on a secure or mastered topic: keep it brief and add one stretch challenge.',
      '- When it fits naturally, add one quick review question on a "due for review" topic.',
      '- Prefer the way this learner learns best.'
    ].join('\n');
  }
}
