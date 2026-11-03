/**
 * Tappable answer options. When Appu offers the learner a choice, the brain ends its reply
 * with `[[OPTIONS: Maths | Science | English]]`. The tag is removed from the text (so it is
 * never saved, shown or voiced) and the options are returned for the app to show as buttons.
 *
 * When the model omits the `[[OPTIONS: ...]]` tag, we fall back to a deterministic extractor
 * over the reply's question sentences (checking the last `?` sentence first, then the previous
 * one) for explicit choice lists (`A, B, or C?`, `A or B?`, `Which one: A or B?`, or two-clause
 * `X, or Y?` offers).
 */
const OPTIONS_TAG = /\[\[\s*OPTIONS\s*:([^\]]*)\]\]/gi;
const MAX_OPTIONS = 4;
const MAX_TAG_OPTION_CHARS = 60;
const MAX_HEURISTIC_OPTION_CHARS = 40;
const MAX_HEURISTIC_OPTION_WORDS = 6;

const PRONOUN_ONLY = new Set([
  'it', 'this', 'that', 'these', 'those', 'them', 'they', 'he', 'she', 'we', 'you', 'me', 'us',
  'him', 'her', 'one', 'ones', 'which', 'what', 'who', 'whom', 'whose', 'mine', 'yours', 'ours',
  'theirs', 'not', 'none', 'other', 'others', 'either', 'neither', 'both', 'all', 'any', 'some',
  'this one', 'that one', 'which one', 'the one'
]);

const OPEN_OR_RHETORICAL_QUESTION_RE = new RegExp(
  '^(?:' +
    'why\\b|' +
    'how\\s+(?:do|does|did|can|could|is|are|was|were|come|many|much|long|far|often)\\b|' +
    'what\\s+(?:happens|happened|makes|made|causes|caused|is\\s+the\\s+difference|do\\s+you\\s+think|does\\s+that\\s+mean)\\b|' +
    'where\\b|when\\b|who\\b|' +
    'can\\s+you\\s+(?:guess|explain|tell|think|name|describe|find|see|imagine|spot|work\\s+out|figure\\s+out)\\b|' +
    'do\\s+you\\s+(?:know|remember|think|see|notice|understand|recall)\\b|' +
    'did\\s+you\\s+(?:know|notice|see)\\b|' +
    'have\\s+you\\s+ever\\b' +
  ')',
  'i'
);

const SHARED_STEM_PREFIX_RE = new RegExp(
  '^(?:' +
    '(?:(?:do\\s+you\\s+want|would\\s+you\\s+like|want)\\s+to\\s+(?:start\\s+with|begin\\s+with|practice|practise|revise|study|learn|focus\\s+on|work\\s+on|go\\s+with|pick|choose|tackle|explore|cover)\\s+)|' +
    '(?:(?:should|shall|can)\\s+we\\s+(?:start\\s+with|begin\\s+with|practice|practise|revise|study|learn|focus\\s+on|work\\s+on|go\\s+with|pick|choose|tackle|explore|cover|do)\\s+)|' +
    '(?:(?:is|was)\\s+it|are\\s+they|are\\s+we\\s+doing|do\\s+you\\s+prefer|would\\s+you\\s+prefer|would\\s+you\\s+like|do\\s+you\\s+want|how\\s+about|what\\s+about|ready\\s+for|up\\s+for|starting\\s+with|start\\s+with|begin\\s+with|go\\s+with|pick|choose|either)\\s+' +
  ')',
  'i'
);

const OPTION_LEADING_PREFIX_RE = new RegExp(
  '^(?:' +
    '(?:or|and|either|maybe|perhaps|like)\\s+|' +
    '(?:is\\s+it|are\\s+they|was\\s+it|could\\s+it\\s+be|would\\s+it\\s+be|is\\s+this)\\s+|' +
    '(?:do\\s+you\\s+want(?:\\s+me)?\\s+to|would\\s+you\\s+like(?:\\s+me)?\\s+to|want(?:\\s+me)?\\s+to|do\\s+you\\s+want|would\\s+you\\s+like|do\\s+you\\s+prefer\\s+to|do\\s+you\\s+prefer|would\\s+you\\s+prefer|would\\s+you\\s+rather)\\s+|' +
    '(?:should\\s+we|shall\\s+we|can\\s+we|let\'?s|how\\s+about\\s+we|what\\s+if\\s+we|should\\s+i|shall\\s+i|can\\s+i)\\s+|' +
    '(?:how\\s+about|what\\s+about)\\s+' +
  ')',
  'i'
);

const UNSTRIPPED_CLAUSE_START_RE = /^(?:which|what|who|whom|whose|where|when|why|how|the\s+one\s+that|whether|if)\b/i;

export interface QuickReplyExtraction {
  text: string;
  quickReplies: string[];
}

function isQuizStyleReply(text: string): boolean {
  if (/\[\[\s*QUIZ_ITEM\b/i.test(text)) return true;
  if (/\bQuestion\s+\d+\s+of\s+\d+\b/i.test(text)) return true;
  if (/(?:^|\n)\s*[A-D][).:]\s+\S+[\s\S]+?(?:^|\n)\s*[B-D][).:]\s+\S+/m.test(text)) return true;
  return false;
}

type CleanedOption =
  | { kind: 'ok'; value: string }
  | { kind: 'drop' }
  | { kind: 'invalid' };

function cleanCandidateOption(raw: string): CleanedOption {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s"“'‘()+*\-—–]+/, '').replace(/[\s"”'’().!?]+$/, '').trim();
  if (!s) return { kind: 'drop' };

  for (let i = 0; i < 4; i++) {
    const next = s.replace(OPTION_LEADING_PREFIX_RE, '').trim();
    if (next === s) break;
    s = next;
  }

  s = s.replace(/^[\s"“'‘()+*\-—–]+/, '').replace(/[\s"”'’.,;:!?—–\-]+$/, '').trim();
  if (!s) return { kind: 'drop' };

  if (/^something\s+else$/i.test(s)) {
    return { kind: 'ok', value: 'Something else' };
  }

  // Convert speaker-to-learner verb phrases ("show you the secret trick") to learner voice ("show me...").
  s = s.replace(/\b(show|give|tell|teach|ask|help|walk)\s+you\b/gi, '$1 me');
  s = s.replace(/\bexplain\s+to\s+you\b/gi, 'explain to me');

  // Trim trailing deictic filler on multi-word action clauses (e.g. "for this", "right now").
  if (s.split(/\s+/).length >= 4) {
    s = s.replace(/\s+for\s+(?:this|that|it|now)$/i, '').replace(/\s+(?:right\s+now|instead)$/i, '').trim();
  }

  s = s.replace(/[\s"”'’.,;:!?—–\-]+$/, '').trim();
  if (!s) return { kind: 'drop' };

  const lower = s.toLowerCase();
  if (PRONOUN_ONLY.has(lower)) {
    return { kind: 'drop' };
  }

  if (UNSTRIPPED_CLAUSE_START_RE.test(s)) {
    return { kind: 'invalid' };
  }

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > MAX_HEURISTIC_OPTION_WORDS || s.length > MAX_HEURISTIC_OPTION_CHARS) {
    return { kind: 'invalid' };
  }

  const capitalised = s.charAt(0).toUpperCase() + s.slice(1);
  return { kind: 'ok', value: capitalised };
}

function extractFromQuestionSentence(rawSentence: string): string[] {
  let q = rawSentence.replace(/\s+/g, ' ').trim();
  if (!q.endsWith('?') || !/\bor\b/i.test(q)) return [];

  q = q.replace(/^[\s"“'‘(]+/, '').replace(/[?!.\s"”'’)]+$/, '').trim();
  if (!q) return [];

  // Strip brief conversational discourse markers at the start of the question sentence.
  q = q.replace(/^(?:so|now|first|next|okay|alright|hey|well|tell\s+me)[,\s]+/i, '').trim();

  if (OPEN_OR_RHETORICAL_QUESTION_RE.test(q)) {
    return [];
  }

  let rawParts: string[] = [];

  if (q.includes(':')) {
    const afterColon = q.slice(q.lastIndexOf(':') + 1).trim();
    if (!afterColon || !/\bor\b/i.test(afterColon)) return [];
    q = afterColon;
  } else {
    // Strip "Which/What <noun> ..., A or B" intro when the comma is not the ", or" separator itself.
    const whCommaMatch = q.match(/^(?:which|what)\b[^,]*,\s*(?!or\b)(.+)$/i);
    if (whCommaMatch && whCommaMatch[1]) {
      q = whCommaMatch[1].trim();
    }
  }

  // Detect whether this is a comma-separated list ("A, B, or C" / "A, B or C") vs a binary/two-clause "X, or Y" / "X or Y".
  const withoutOxfordOr = q.replace(/,\s+or\s+/gi, '__OXFORD_OR__');
  const hasListComma = withoutOxfordOr.includes(',');

  if (hasListComma) {
    // Strip shared question stem from the front of the list.
    q = q.replace(SHARED_STEM_PREFIX_RE, '').trim();
    const normalized = q.replace(/\s*,\s+or\s+/gi, ', ');
    const commaSegments = normalized.split(/\s*,\s*/).filter(Boolean);
    for (let i = 0; i < commaSegments.length; i++) {
      const seg = commaSegments[i];
      if (i === commaSegments.length - 1 && /\s+or\s+/i.test(seg)) {
        rawParts.push(...seg.split(/\s+or\s+/i));
      } else {
        rawParts.push(seg);
      }
    }
  } else {
    // Binary or two-clause question ("X, or Y?" / "A or B?").
    const isTwoClause = /,\s+or\s+|\s+[—–-]\s*or\s+/i.test(q) ||
      /\s+or\s+(?:should|shall|can|would|do|want|let'?s)\b/i.test(q);
    if (!isTwoClause) {
      q = q.replace(SHARED_STEM_PREFIX_RE, '').trim();
    }
    rawParts = q.split(/\s*(?:,\s*|\s+[—–-]\s*|\s+)or\s+/i).filter(Boolean);
  }

  if (rawParts.length < 2) return [];

  const seen = new Set<string>();
  const options: string[] = [];

  for (const part of rawParts) {
    const cleaned = cleanCandidateOption(part);
    if (cleaned.kind === 'invalid') {
      return [];
    }
    if (cleaned.kind === 'drop') {
      continue;
    }
    const key = cleaned.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(cleaned.value);
  }

  if (options.length < 2 || options.length > MAX_OPTIONS) {
    return [];
  }

  return options;
}

function extractHeuristicQuickReplies(text: string): string[] {
  if (!text || isQuizStyleReply(text)) return [];

  // Match sentences ending with '?'.
  const matches = text.match(/[^.!?\n]*\?/g);
  if (!matches || matches.length === 0) return [];

  // Check the LAST "?" sentence first, then the previous one.
  const startIdx = Math.max(0, matches.length - 2);
  for (let i = matches.length - 1; i >= startIdx; i--) {
    const extracted = extractFromQuestionSentence(matches[i]);
    if (extracted.length >= 2 && extracted.length <= MAX_OPTIONS) {
      return extracted;
    }
  }
  return [];
}

export function extractQuickReplies(rawText: string): QuickReplyExtraction {
  if (typeof rawText !== 'string' || !rawText) return { text: rawText, quickReplies: [] };

  let last: string | null = null;
  for (const match of rawText.matchAll(OPTIONS_TAG)) last = match[1];

  const text = rawText.replace(OPTIONS_TAG, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (last !== null) {
    const seen = new Set<string>();
    const quickReplies: string[] = [];
    for (const part of last.split('|')) {
      const option = part.replace(/\s+/g, ' ').trim();
      const key = option.toLowerCase();
      if (!option || option.length > MAX_TAG_OPTION_CHARS || seen.has(key)) continue;
      seen.add(key);
      quickReplies.push(option);
      if (quickReplies.length === MAX_OPTIONS) break;
    }
    // A single option is not a choice.
    return { text, quickReplies: quickReplies.length >= 2 ? quickReplies : [] };
  }

  return { text, quickReplies: extractHeuristicQuickReplies(text) };
}
