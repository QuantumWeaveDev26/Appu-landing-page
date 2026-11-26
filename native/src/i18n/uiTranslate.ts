/**
 * Translates app UI text into Hindi / Kannada like the website's AppuI18n: the dictionary is
 * keyed by the English text, numbers become {n} ("3 Days" → "{n} Days"), and leading/trailing
 * icons are kept. Unknown text stays in English. Chat messages are never passed through here.
 */
import webDict from './uiDict.json';
import appDict from './uiExtra.json';

const DICT: Record<string, string[]> = { ...(webDict as Record<string, string[]>) };
for (const [key, value] of Object.entries(appDict as Record<string, string[]>)) {
  if (value[0] && value[1]) DICT[key] = value;
}

const NUM = /\d[\d,]*/g;
const EDGES = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}.!?…)"”]*)$/u;

export function translateUi(text: string, lang: string): string {
  if ((lang !== 'hi' && lang !== 'kn') || !text) return text;
  const m = text.match(EDGES);
  if (!m || !m[2]) return text;
  const core = m[2];
  const entry = DICT[core.replace(NUM, '{n}')];
  const target = entry && entry[lang === 'hi' ? 0 : 1];
  if (!target) return text;
  const nums = core.match(NUM) || [];
  let i = 0;
  return m[1] + target.replace(/\{n\}/g, () => (i < nums.length ? nums[i++] : '')) + m[3];
}
