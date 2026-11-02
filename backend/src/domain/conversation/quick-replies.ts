/**
 * Tappable answer options. When Appu offers the learner a choice, the brain ends its reply
 * with `[[OPTIONS: Maths | Science | English]]`. The tag is removed from the text (so it is
 * never saved, shown or voiced) and the options are returned for the app to show as buttons.
 */
const OPTIONS_TAG = /\[\[\s*OPTIONS\s*:([^\]]*)\]\]/gi;
const MAX_OPTIONS = 4;
const MAX_OPTION_CHARS = 60;

export interface QuickReplyExtraction {
  text: string;
  quickReplies: string[];
}

export function extractQuickReplies(rawText: string): QuickReplyExtraction {
  if (typeof rawText !== 'string' || !rawText) return { text: rawText, quickReplies: [] };

  let last: string | null = null;
  for (const match of rawText.matchAll(OPTIONS_TAG)) last = match[1];

  const text = rawText.replace(OPTIONS_TAG, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (last === null) return { text, quickReplies: [] };

  const seen = new Set<string>();
  const quickReplies: string[] = [];
  for (const part of last.split('|')) {
    const option = part.replace(/\s+/g, ' ').trim();
    const key = option.toLowerCase();
    if (!option || option.length > MAX_OPTION_CHARS || seen.has(key)) continue;
    seen.add(key);
    quickReplies.push(option);
    if (quickReplies.length === MAX_OPTIONS) break;
  }
  // A single option is not a choice.
  return { text, quickReplies: quickReplies.length >= 2 ? quickReplies : [] };
}
