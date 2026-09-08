/**
 * Curated Pedagogical Tip Catalogue & Tiering for CBSE Learners.
 */

export type GradeTier = '5-7' | '8-10' | '11-12';

export function resolveGradeTier(gradeBand?: string | null): GradeTier {
  if (!gradeBand) return '5-7';
  const match = gradeBand.match(/\d+/);
  if (!match) {
    const lower = gradeBand.toLowerCase();
    if (lower.includes('11') || lower.includes('12')) return '11-12';
    if (lower.includes('8') || lower.includes('9') || lower.includes('10')) return '8-10';
    return '5-7';
  }
  const num = parseInt(match[0], 10);
  if (num >= 11) return '11-12';
  if (num >= 8) return '8-10';
  return '5-7';
}

export const CURATED_TIPS: Record<GradeTier, string[]> = {
  '5-7': [
    'Break tricky math questions into smaller steps — draw a quick diagram or picture if you feel stuck!',
    'Read new science terms out loud and make up a funny story to remember them easily.',
    'Before starting homework, spend 2 minutes reviewing yesterday\'s notes. It warms up your brain!',
    'When reading a chapter, pause after each page and ask yourself: what was the coolest fact here?',
    'Take a 5-minute movement break after every 25 minutes of study. It keeps your focus sharp!',
    'Keep a curiosity notebook — write down questions you want to ask Appu later today!',
    'Explain what you learned today to a parent or friend. Teaching is the best way to master a topic!'
  ],
  '8-10': [
    'After studying a concept, try explaining it in your own words without looking at your book (active recall).',
    'Write down key formulas on a small flashcard before starting your practice problem set.',
    'When solving geometry or physics questions, label all given data clearly before writing down formulas.',
    'Practice one timed question every day to build problem-solving speed and reduce exam anxiety.',
    'When reviewing test mistakes, note WHY it happened: concept gap, calculation slip, or misread question?',
    'Organize your study desk before beginning — a clean workspace leads to a clear and focused mind.',
    'Connect science concepts to everyday life: observe reflections, shadows, and simple machines at home!'
  ],
  '11-12': [
    'Focus on understanding core derivations and concepts today — 3 deeply understood problems beat 10 rushed ones.',
    'Identify one concept that felt challenging this week and ask Appu for two step-by-step examples.',
    'Alternate between numerical problem-solving and concept-heavy reading to stay energized and engaged.',
    'Always check units and dimensional consistency in numerical physics and chemistry problems.',
    'Create one-page summary sheets for completed chapters containing all formulas, conditions, and exceptions.',
    'Prioritize NCERT examples and past-year board questions before jumping into advanced reference books.',
    'Schedule regular 15-minute revision blocks for topics you studied two weeks ago to beat the forgetting curve.'
  ]
};

/**
 * Returns a pedagogical tip for the given grade tier, deterministically rotating based on date.
 */
export function getTipForDay(
  tier: GradeTier,
  date: Date = new Date(),
  childName?: string,
  subject?: string
): string {
  const pool = CURATED_TIPS[tier] || CURATED_TIPS['5-7'];
  
  // Deterministic daily index based on UTC date timestamp
  const dayIndex = Math.floor(date.getTime() / 86400000);
  const index = Math.abs(dayIndex) % pool.length;
  let tip = pool[index];

  if (childName && tip.includes('{name}')) {
    tip = tip.replace(/\{name\}/g, childName);
  }
  if (subject && tip.includes('{subject}')) {
    tip = tip.replace(/\{subject\}/g, subject);
  }

  return tip.replace(/[\r\n\t]+/g, ' ').trim();
}
