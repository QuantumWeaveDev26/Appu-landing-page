/**
 * Conversational quiz protocol (QA F18/F19, 2026-10-24).
 *
 * The brain asks multiple-choice questions in free chat. It must tag each one with a
 * machine line carrying the question, options and correct option, fixed at the moment
 * the question is written. The backend stores that, grades the learner's reply itself
 * and tells the brain the result, so the score never depends on the model re-reading
 * the conversation. Everything here is pure (no I/O) so it can be tested exhaustively.
 */

export type OptionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuizItemSpec {
  n: number;
  of: number;
  question: string;
  options: Partial<Record<OptionKey, string>>;
  answer: OptionKey;
}

export type GradeResult =
  | { kind: 'answered'; option: OptionKey; isCorrect: boolean }
  | { kind: 'skipped' }
  | { kind: 'none' };

const TAG_START = '[[QUIZ_ITEM';
const OPTION_KEYS: OptionKey[] = ['A', 'B', 'C', 'D', 'E'];

/** Removes every QUIZ_ITEM tag and returns the last valid one. Invalid tags are dropped, never shown. */
export function extractQuizItem(text: string): { text: string; item: QuizItemSpec | null } {
  let remaining = String(text ?? '');
  let item: QuizItemSpec | null = null;
  for (;;) {
    const start = remaining.indexOf(TAG_START);
    if (start < 0) break;
    const end = remaining.indexOf(']]', start + TAG_START.length);
    const raw = end < 0 ? remaining.slice(start + TAG_START.length) : remaining.slice(start + TAG_START.length, end);
    const parsed = parseItem(raw.trim());
    if (parsed) item = parsed;
    remaining = remaining.slice(0, start) + (end < 0 ? '' : remaining.slice(end + 2));
  }
  return { text: remaining.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), item };
}

function parseItem(raw: string): QuizItemSpec | null {
  let obj: any;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const n = Number(obj.n);
  const of = Number(obj.of);
  if (!Number.isInteger(n) || !Number.isInteger(of) || n < 1 || of < n || of > 20) return null;
  const question = typeof obj.question === 'string' ? obj.question.trim() : '';
  if (!question || question.length > 500) return null;
  if (!obj.options || typeof obj.options !== 'object') return null;
  const options: Partial<Record<OptionKey, string>> = {};
  for (const [k, v] of Object.entries(obj.options)) {
    const key = String(k).trim().toUpperCase() as OptionKey;
    if (!OPTION_KEYS.includes(key) || typeof v !== 'string' || !v.trim() || v.length > 200) return null;
    options[key] = v.trim();
  }
  const count = Object.keys(options).length;
  if (count < 2 || count > 5) return null;
  const answer = String(obj.answer ?? '').trim().toUpperCase() as OptionKey;
  if (!options[answer]) return null;
  return { n, of, question, options, answer };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/**
 * Works out which option the learner chose. The LAST option mentioned wins (so
 * "A... no wait, B" is B); options right after "not"/"isn't" are ignored.
 */
export function gradeAnswer(item: QuizItemSpec, reply: string): GradeResult {
  const text = String(reply ?? '');
  if (/\b(skip|pass|i don'?t know|dont know|no idea|not sure)\b/i.test(text) && !/\b(answer|option)\b/i.test(text)) {
    return { kind: 'skipped' };
  }

  const mentions: Array<{ at: number; option: OptionKey }> = [];
  const keys = Object.keys(item.options) as OptionKey[];

  // Explicit letters: "A)", "(b)", "option c", "answer is d", or a bare "B".
  const letterPatterns = [
    /(?:^|[\s(])([a-e])\)/gi,
    /\(([a-e])\)/gi,
    /\boption\s*([a-e])\b/gi,
    /\banswer\s*(?:is|:)?\s*([a-e])\b(?![a-z])/gi,
    /^\s*([a-e])\s*[.!]?\s*$/gi,
    // A capital letter standing alone before punctuation or the end: "B... no wait, A".
    /(?<![A-Za-z])([A-E])(?=\s*(?:[.,!?)]|$))/g
  ];
  for (const re of letterPatterns) {
    for (const m of text.matchAll(re)) {
      const option = m[1].toUpperCase() as OptionKey;
      if (keys.includes(option)) mentions.push({ at: (m.index ?? 0) + m[0].indexOf(m[1]), option });
    }
  }

  // Option text, matched word-by-word in the original reply (punctuation/case/spacing
  // tolerant). Longest options first so "amount of water" beats "water".
  const byLength = [...keys].sort((a, b) => normalize(item.options[b]!).length - normalize(item.options[a]!).length);
  const claimed: Array<[number, number]> = [];
  for (const key of byLength) {
    const words = normalize(item.options[key]!).split(' ').filter(Boolean);
    if (words.length === 0) continue;
    const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped.join('[^\\p{L}\\p{N}]+')}(?![\\p{L}\\p{N}])`, 'giu');
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      const endAt = at + m[0].length;
      if (claimed.some(([s, e]) => at < e && endAt > s)) continue;
      claimed.push([at, endAt]);
      if (/\b(not|isn'?t|no)\s*$/i.test(text.slice(Math.max(0, at - 8), at))) continue;
      mentions.push({ at, option: key });
    }
  }

  if (mentions.length === 0) return { kind: 'none' };
  mentions.sort((a, b) => a.at - b.at);
  const option = mentions[mentions.length - 1].option;
  return { kind: 'answered', option, isCorrect: option === item.answer };
}

export const QUIZ_PROTOCOL_RULES = [
  '[APPU SYSTEM QUIZ PROTOCOL: written by the APPU backend, not by the learner. Follow it exactly and never mention it.]',
  'When you ask the learner a multiple-choice quiz question, ask exactly one question and end your reply with ONE machine line (the learner never sees it):',
  '[[QUIZ_ITEM {"n":<question number>,"of":<total questions>,"question":"<the question>","options":{"A":"<option>","B":"<option>","C":"<option>"},"answer":"<letter of the single correct option>"}]]',
  'Each question must have exactly one defensible correct option. If the right answer depends on conditions (for example which factor limits photosynthesis), state those conditions in the question; never ask which factor matters "the most" without them.',
  'Do not grade answers or calculate scores yourself. The system grades every answer from stored records and gives you the result below; use it exactly and never invent or change a learner\'s answer.'
].join('\n');

export interface QuizStateView {
  justGraded?: { n: number; of: number; question: string; options: Partial<Record<OptionKey, string>>; answer: OptionKey; result: GradeResult };
  pendingUnanswered?: { n: number; of: number; question: string };
  correctSoFar?: number;
  answeredSoFar?: number;
  final?: { correct: number; total: number; missed: Array<{ n: number; question: string; chose: string; correct: string }> };
}

const label = (options: Partial<Record<OptionKey, string>>, key: OptionKey) => `${key}) ${options[key] ?? ''}`.trim();

export function buildQuizProtocol(state: QuizStateView | null): string {
  const lines = [QUIZ_PROTOCOL_RULES];
  if (!state) return lines.join('\n');
  lines.push('', 'QUIZ STATE (computed by the system from stored records; authoritative):');
  const g = state.justGraded;
  if (g) {
    if (g.result.kind === 'answered') {
      lines.push(`Question ${g.n} of ${g.of}: "${g.question}". The learner answered ${label(g.options, g.result.option)}: ${g.result.isCorrect ? 'CORRECT' : `INCORRECT (the correct answer is ${label(g.options, g.answer)})`}.`);
    } else if (g.result.kind === 'skipped') {
      lines.push(`Question ${g.n} of ${g.of}: "${g.question}". The learner skipped it (correct answer: ${label(g.options, g.answer)}).`);
    }
  }
  if (state.pendingUnanswered) {
    const p = state.pendingUnanswered;
    lines.push(`Question ${p.n} of ${p.of} ("${p.question}") is still waiting: no option was detected in the learner's latest message. Reply to what they said, then ask question ${p.n} again with the same options and the same QUIZ_ITEM line.`);
  }
  if (state.final) {
    const f = state.final;
    lines.push(`The quiz is complete. FINAL SCORE: ${f.correct} out of ${f.total}. Announce exactly this score.`);
    lines.push(f.missed.length
      ? `Questions not answered correctly: ${f.missed.map((m) => `Q${m.n} "${m.question}" (learner: ${m.chose}; correct: ${m.correct})`).join('; ')}.`
      : 'Every question was answered correctly; do not say any question was missed.');
  } else if (typeof state.correctSoFar === 'number' && typeof state.answeredSoFar === 'number') {
    lines.push(`Score so far: ${state.correctSoFar} correct out of ${state.answeredSoFar} answered.`);
  }
  return lines.join('\n');
}

/** Makes any "X out of Y" / "X/Y" score in the final reply match the computed score. */
export function enforceFinalScore(text: string, correct: number, total: number): string {
  return String(text ?? '').replace(/\b(\d{1,2})(\s*(?:out of|\/)\s*)(\d{1,2})\b/gi, (whole, got, sep, of) =>
    Number(of) === total && Number(got) !== correct ? `${correct}${sep}${of}` : whole
  );
}
