import type {
  BirthdayTarget,
  EligibleHouseholdTarget,
  MetaTemplateParameter,
  WeeklyActivityMetrics
} from './types.js';
import { getTipForDay, resolveGradeTier } from './tip-catalogue.js';

/**
 * Sanitizes template parameters to comply with Meta WhatsApp Cloud API text rules:
 * - No leading/trailing whitespace
 * - No linebreaks (\r, \n) or tabs within variable text
 * - Bounded within maximum character lengths
 */
export function sanitizeMetaParam(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  const cleaned = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3).trim() + '...';
}

/**
 * Determines if a conversation session title is a plausible academic study topic.
 * Filters out auto-generated welcome lines, greetings, conversational remarks, question sentences,
 * and overly long titles (> 40 chars).
 */
export function isValidTopicTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  if (/[?!]/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("appu") ||
    lower.includes("hello") ||
    lower.includes("welcome") ||
    lower.includes("namaste") ||
    lower.includes("conversation") ||
    lower.includes("untitled") ||
    lower.startsWith("hi ") ||
    lower.startsWith("hey ") ||
    lower.includes("what would you like") ||
    lower.includes("how are you") ||
    lower.includes("how are u")
  ) {
    return false;
  }
  return true;
}

export class WeeklyDigestGenerator {
  /**
   * Generates parameters for template `appu_weekly_digest`:
   * {{1}}: Child effective name
   * {{2}}: Weekly learning summary (from real sessions/messages, with friendly 0-session fallback)
   * {{3}}: Focus areas for next week
   */
  public static generate(
    target: EligibleHouseholdTarget,
    metrics: WeeklyActivityMetrics
  ): MetaTemplateParameter[] {
    const childName = sanitizeMetaParam(target.effectiveName, 40);

    let summary = '';
    let focus = '';

    if (metrics.sessionCount > 0) {
      const sessionWord = metrics.sessionCount === 1 ? 'study session' : 'study sessions';
      const qWord = metrics.userQuestionCount === 1 ? 'question' : 'questions';

      const validTopics = (metrics.recentTopics || []).filter(isValidTopicTitle);

      let topicPhrase = '';
      if (validTopics.length > 0) {
        topicPhrase = ` exploring ${validTopics.slice(0, 2).join(' and ')}`;
      } else if (metrics.favoriteSubjects.length > 0) {
        topicPhrase = ` exploring ${metrics.favoriteSubjects.slice(0, 2).join(' & ')}`;
      }

      summary = sanitizeMetaParam(
        `Completed ${metrics.sessionCount} ${sessionWord} (${metrics.userQuestionCount} ${qWord} asked)${topicPhrase}.`,
        250
      );

      let focusTopic = 'Core concepts';
      if (metrics.favoriteSubjects.length > 0) {
        focusTopic = metrics.favoriteSubjects[0];
      } else if (validTopics.length > 0) {
        focusTopic = validTopics[0];
      }
      focus = sanitizeMetaParam(`${focusTopic} practice and consistent daily study habits.`, 150);
    } else {
      summary = sanitizeMetaParam(
        `No sessions logged this past week. APPU is ready to help ${childName} learn anytime!`,
        250
      );
      const subject = metrics.favoriteSubjects.length > 0 ? metrics.favoriteSubjects[0] : 'Mathematics & Science';
      focus = sanitizeMetaParam(`${subject} fundamentals, and getting started with a first session.`, 150);
    }

    return [
      { type: 'text', text: childName },
      { type: 'text', text: summary },
      { type: 'text', text: focus }
    ];
  }
}

export class DailyTipGenerator {
  /**
   * Generates parameters for template `appu_daily_tip`:
   * {{1}}: Child effective name
   * {{2}}: Age-adapted pedagogical study tip
   */
  public static generate(
    target: EligibleHouseholdTarget,
    date: Date = new Date()
  ): MetaTemplateParameter[] {
    const childName = sanitizeMetaParam(target.effectiveName, 40);
    const tier = resolveGradeTier(target.gradeBand);
    const rawTip = getTipForDay(tier, date, childName, target.favoriteSubjects[0]);
    const tip = sanitizeMetaParam(rawTip, 250);

    return [
      { type: 'text', text: childName },
      { type: 'text', text: tip }
    ];
  }
}

export class BirthdayWishGenerator {
  /**
   * Generates parameters for template `appu_birthday_wish`:
   * {{1}}: Child effective name
   */
  public static generate(target: BirthdayTarget | EligibleHouseholdTarget): MetaTemplateParameter[] {
    const childName = sanitizeMetaParam(target.effectiveName, 40);
    return [{ type: 'text', text: childName }];
  }
}
