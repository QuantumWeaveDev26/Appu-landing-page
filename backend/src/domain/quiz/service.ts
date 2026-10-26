import crypto from 'node:crypto';
import type { Queryable } from '../../db/types.js';
import {
  buildQuizProtocol,
  enforceFinalScore,
  extractQuizItem,
  gradeAnswer,
  type GradeResult,
  type OptionKey,
  type QuizItemSpec,
  type QuizStateView
} from './protocol.js';

interface QuizItemRow {
  id: string;
  quiz_id: string;
  question_no: number;
  total_questions: number;
  question: string;
  options: Partial<Record<OptionKey, string>> | string;
  correct_option: OptionKey;
  status: 'pending' | 'answered' | 'skipped' | 'abandoned';
  learner_option: OptionKey | null;
  is_correct: boolean | null;
}

export interface QuizScope {
  householdId: string;
  childId: string;
  conversationId: string;
}

/** What prepareTurn worked out before the brain is called; committed only if the brain succeeds. */
export interface QuizTurnPlan {
  protocol: string;
  pending: QuizItemRow | null;
  grade: GradeResult | null;
}

export interface QuizTurnOutcome {
  text: string;
  quiz: null | {
    quizId: string;
    questionNo: number;
    totalQuestions: number;
    correct: number;
    answered: number;
    final: boolean;
  };
}

const toSpec = (row: QuizItemRow): QuizItemSpec => ({
  n: Number(row.question_no),
  of: Number(row.total_questions),
  question: row.question,
  options: typeof row.options === 'string' ? JSON.parse(row.options) : row.options,
  answer: row.correct_option
});

async function latestPending(db: Queryable, scope: QuizScope): Promise<QuizItemRow | null> {
  const res = await db.query<QuizItemRow>(
    `SELECT id, quiz_id, question_no, total_questions, question, options, correct_option, status, learner_option, is_correct
     FROM conversation_quiz_items
     WHERE conversation_id = $1 AND household_id = $2 AND child_id = $3 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [scope.conversationId, scope.householdId, scope.childId]
  );
  return res.rows[0] ?? null;
}

async function quizRows(db: Queryable, scope: QuizScope, quizId: string): Promise<QuizItemRow[]> {
  const res = await db.query<QuizItemRow>(
    `SELECT id, quiz_id, question_no, total_questions, question, options, correct_option, status, learner_option, is_correct
     FROM conversation_quiz_items
     WHERE quiz_id = $1 AND conversation_id = $2 AND household_id = $3 AND child_id = $4
     ORDER BY question_no ASC`,
    [quizId, scope.conversationId, scope.householdId, scope.childId]
  );
  return res.rows;
}

function tally(rows: QuizItemRow[]) {
  const done = rows.filter((r) => r.status === 'answered' || r.status === 'skipped');
  return { correct: done.filter((r) => r.is_correct === true).length, answered: done.length };
}

export class ConversationQuizService {
  /**
   * Grades the learner's message against the open question (if any) and builds the
   * protocol text for the brain. Nothing is written here: a failed brain call must not
   * consume the learner's answer.
   */
  static async prepareTurn(db: Queryable, scope: QuizScope, learnerMessage: string): Promise<QuizTurnPlan> {
    const pending = await latestPending(db, scope);
    if (!pending) return { protocol: buildQuizProtocol(null), pending: null, grade: null };

    const spec = toSpec(pending);
    const grade = gradeAnswer(spec, learnerMessage);
    const rows = await quizRows(db, scope, pending.quiz_id);
    const before = tally(rows);

    const state: QuizStateView = {};
    if (grade.kind === 'none') {
      state.pendingUnanswered = { n: spec.n, of: spec.of, question: spec.question };
      state.correctSoFar = before.correct;
      state.answeredSoFar = before.answered;
    } else {
      state.justGraded = { ...spec, result: grade };
      const correct = before.correct + (grade.kind === 'answered' && grade.isCorrect ? 1 : 0);
      const answered = before.answered + 1;
      if (spec.n >= spec.of) {
        const missed = rows
          .filter((r) => r.id !== pending.id && r.is_correct !== true && r.status !== 'pending')
          .map((r) => ({ spec: toSpec(r), chose: r.learner_option as OptionKey | null, status: r.status }));
        if (!(grade.kind === 'answered' && grade.isCorrect)) {
          missed.push({ spec, chose: grade.kind === 'answered' ? grade.option : null, status: grade.kind === 'answered' ? 'answered' : 'skipped' });
        }
        state.final = {
          correct,
          total: spec.of,
          missed: missed.map(({ spec: s, chose, status }) => ({
            n: s.n,
            question: s.question,
            chose: chose ? `${chose}) ${s.options[chose] ?? ''}`.trim() : (status === 'abandoned' ? 'not answered' : 'skipped'),
            correct: `${s.answer}) ${s.options[s.answer]}`
          }))
        };
      } else {
        state.correctSoFar = correct;
        state.answeredSoFar = answered;
      }
    }
    return { protocol: buildQuizProtocol(state), pending, grade };
  }

  /**
   * After a successful brain reply: record the graded answer exactly once, store any new
   * question the reply asked, strip the machine tag and pin the final score to the records.
   */
  static async commitTurn(
    db: Queryable,
    scope: QuizScope,
    plan: QuizTurnPlan | null,
    requestId: string,
    replyText: string
  ): Promise<QuizTurnOutcome> {
    const { text, item } = extractQuizItem(replyText);
    let finalText = text;
    let quiz: QuizTurnOutcome['quiz'] = null;

    const pending = plan?.pending ?? null;
    if (pending && plan?.grade && plan.grade.kind !== 'none') {
      const g = plan.grade;
      // status = 'pending' guard makes the award exactly-once even on a retried request.
      await db.query(
        `UPDATE conversation_quiz_items
         SET status = $1, learner_option = $2, is_correct = $3, answered_request_id = $4, answered_at = NOW()
         WHERE id = $5 AND status = 'pending'`,
        [
          g.kind === 'answered' ? 'answered' : 'skipped',
          g.kind === 'answered' ? g.option : null,
          g.kind === 'answered' ? g.isCorrect : false,
          requestId,
          pending.id
        ]
      );
      const rows = await quizRows(db, scope, pending.quiz_id);
      const t = tally(rows);
      const final = Number(pending.question_no) >= Number(pending.total_questions);
      if (final) finalText = enforceFinalScore(finalText, t.correct, Number(pending.total_questions));
      quiz = {
        quizId: pending.quiz_id,
        questionNo: Number(pending.question_no),
        totalQuestions: Number(pending.total_questions),
        correct: t.correct,
        answered: t.answered,
        final
      };
    }

    if (item) {
      // Same quiz while it is still running (next question or a re-ask); otherwise a new quiz.
      const stillPending = await latestPending(db, scope);
      let quizId: string;
      if (stillPending && item.n === Number(stillPending.question_no)) {
        quizId = stillPending.quiz_id;
      } else {
        if (stillPending) {
          // The brain moved on without an answer: the open question no longer counts as pending.
          await db.query(
            `UPDATE conversation_quiz_items SET status = 'abandoned' WHERE id = $1 AND status = 'pending'`,
            [stillPending.id]
          );
        }
        const continuing = item.n > 1 && pending && Number(pending.question_no) < Number(pending.total_questions)
          && item.n === Number(pending.question_no) + 1;
        quizId = continuing && pending ? pending.quiz_id : crypto.randomUUID();
      }
      await db.query(
        `INSERT INTO conversation_quiz_items (
           household_id, child_id, conversation_id, quiz_id, question_no, total_questions,
           question, options, correct_option, asked_request_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (quiz_id, question_no) DO UPDATE
           SET question = EXCLUDED.question, options = EXCLUDED.options, correct_option = EXCLUDED.correct_option,
               total_questions = EXCLUDED.total_questions, asked_request_id = EXCLUDED.asked_request_id
           WHERE conversation_quiz_items.status = 'pending'`,
        [scope.householdId, scope.childId, scope.conversationId, quizId, item.n, item.of,
         item.question, JSON.stringify(item.options), item.answer, requestId]
      );
    }

    return { text: finalText, quiz };
  }
}
