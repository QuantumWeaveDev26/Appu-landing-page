import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuizProtocol,
  enforceFinalScore,
  extractQuizItem,
  gradeAnswer,
  type QuizItemSpec
} from '../src/domain/quiz/protocol.js';

// The five questions and learner replies recorded in QA 2026-10-24 (evidence/conversational-quiz.txt).
const RECORDED: Array<{ item: QuizItemSpec; reply: string }> = [
  { item: { n: 1, of: 5, question: 'Which pigment captures sunlight?', options: { A: 'Chlorophyll', B: 'Carotene', C: 'Xanthophyll' }, answer: 'A' },
    reply: 'A) Chlorophyll. Please continue to Question 2 of 5.' },
  { item: { n: 2, of: 5, question: 'What gas do plants take in?', options: { A: 'Oxygen', B: 'Carbon Dioxide', C: 'Nitrogen' }, answer: 'B' },
    reply: 'B) Carbon dioxide. Continue to Question 3 of 5.' },
  { item: { n: 3, of: 5, question: 'Where does photosynthesis happen?', options: { A: 'Mitochondria', B: 'Chloroplast', C: 'Nucleus' }, answer: 'B' },
    reply: 'B) Chloroplast. Continue to Question 4 of 5.' },
  { item: { n: 4, of: 5, question: 'What do plants release?', options: { A: 'Oxygen', B: 'Carbon Dioxide', C: 'Nitrogen' }, answer: 'A' },
    reply: 'A) Oxygen. Continue to Question 5 of 5.' },
  { item: { n: 5, of: 5, question: 'Which of these affects the rate of photosynthesis the most?', options: { A: 'Light intensity', B: 'Soil type', C: 'Amount of water' }, answer: 'A' },
    reply: 'A) Light intensity. That is my answer to Question 5. Please give my final score out of five.' }
];

test('the recorded F18 quiz grades every answer correct (5/5), including question 4 = oxygen', () => {
  const results = RECORDED.map(({ item, reply }) => gradeAnswer(item, reply));
  assert.deepEqual(results.map((r) => r.kind === 'answered' && r.option), ['A', 'B', 'B', 'A', 'A']);
  assert.ok(results.every((r) => r.kind === 'answered' && r.isCorrect));
});

test('a wrong final score in the brain reply is pinned to the stored score', () => {
  const reply = 'You got 4 out of 5 right, Navee! The tricky one was Question 4.';
  assert.match(enforceFinalScore(reply, 5, 5), /You got 5 out of 5 right/);
  assert.equal(enforceFinalScore('Score: 3/5', 3, 5), 'Score: 3/5');
  assert.equal(enforceFinalScore('Score: 2/5', 3, 5), 'Score: 3/5');
  // Unrelated numbers (a different denominator) are left alone.
  assert.equal(enforceFinalScore('Earth spins 1 out of 24 hours', 3, 5), 'Earth spins 1 out of 24 hours');
});

const q4 = RECORDED[3].item;

test('incorrect answers are graded incorrect', () => {
  const r = gradeAnswer(q4, 'B) Carbon dioxide');
  assert.deepEqual(r, { kind: 'answered', option: 'B', isCorrect: false });
});

test('a corrected answer counts the last option given', () => {
  assert.deepEqual(gradeAnswer(q4, 'B... no wait, A'), { kind: 'answered', option: 'A', isCorrect: true });
  assert.deepEqual(gradeAnswer(q4, 'Carbon dioxide? Actually I think oxygen'), { kind: 'answered', option: 'A', isCorrect: true });
  assert.deepEqual(gradeAnswer(q4, 'It is oxygen, not carbon dioxide'), { kind: 'answered', option: 'A', isCorrect: true });
});

test('bare letters, option words and option text in any case are understood', () => {
  assert.equal((gradeAnswer(q4, 'a') as any).option, 'A');
  assert.equal((gradeAnswer(q4, 'option c') as any).option, 'C');
  assert.equal((gradeAnswer(q4, 'NITROGEN!') as any).option, 'C');
  assert.equal((gradeAnswer(q4, 'my answer is b') as any).option, 'B');
});

test('skipped answers and non-answers are distinguished', () => {
  assert.deepEqual(gradeAnswer(q4, "I don't know, skip"), { kind: 'skipped' });
  assert.deepEqual(gradeAnswer(q4, 'What does byproduct mean?'), { kind: 'none' });
});

test('longer options win over options they contain', () => {
  const item: QuizItemSpec = { n: 1, of: 1, question: 'q', options: { A: 'Water', B: 'Amount of water', C: 'Soil' }, answer: 'B' };
  assert.equal((gradeAnswer(item, 'amount of water') as any).option, 'B');
  assert.equal((gradeAnswer(item, 'water') as any).option, 'A');
});

test('quiz machine tags are stripped from what the learner sees, valid or not', () => {
  const raw = 'Ready for Question 4?\nWhat do plants release?\nA) Oxygen\n\n[[QUIZ_ITEM {"n":4,"of":5,"question":"What do plants release?","options":{"A":"Oxygen","B":"Carbon Dioxide","C":"Nitrogen"},"answer":"A"}]]';
  const { text, item } = extractQuizItem(raw);
  assert.ok(!text.includes('QUIZ_ITEM'));
  assert.equal(item?.n, 4);
  assert.equal(item?.answer, 'A');

  const bad = extractQuizItem('Hi [[QUIZ_ITEM {"n":4,"of":5,"question":"x","options":{"A":"y"},"answer":"Z"}]] there');
  assert.equal(bad.item, null);
  assert.equal(bad.text, 'Hi  there');
  assert.ok(!bad.text.includes('QUIZ_ITEM'));
  assert.equal(extractQuizItem('Unterminated [[QUIZ_ITEM {"n":1').text, 'Unterminated');
});

test('the protocol tells the brain the authoritative grade and final score', () => {
  const p = buildQuizProtocol({
    justGraded: { ...q4, result: { kind: 'answered', option: 'A', isCorrect: true } },
    final: { correct: 5, total: 5, missed: [] }
  });
  assert.match(p, /learner answered A\) Oxygen: CORRECT/);
  assert.match(p, /FINAL SCORE: 5 out of 5/);
  assert.match(p, /do not say any question was missed/);
  assert.match(buildQuizProtocol(null), /QUIZ_ITEM/);
  // F19: the rules demand one defensible answer with stated conditions.
  assert.match(buildQuizProtocol(null), /exactly one defensible correct option/);
});
