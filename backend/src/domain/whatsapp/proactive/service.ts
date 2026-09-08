import type { Queryable } from '../../../db/types.js';
import { ProactiveWhatsAppRepository } from './repository.js';
import {
  BirthdayWishGenerator,
  DailyTipGenerator,
  WeeklyDigestGenerator
} from './generators.js';
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  type ProactiveTargetPayload
} from './types.js';

export interface ProactiveGenerateOptions {
  dryRun?: boolean;
  limit?: number;
  referenceDate?: Date;
}

export class ProactiveWhatsAppService {
  /**
   * Generates proactive payloads for the Weekly Parent Digest (`appu_weekly_digest`).
   * For each consenting household, calculates real activity metrics over the past 7 days.
   */
  public static async generateWeeklyDigest(
    db: Queryable,
    options?: ProactiveGenerateOptions
  ): Promise<ProactiveTargetPayload[]> {
    const referenceDate = options?.referenceDate || new Date();
    const sevenDaysAgo = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const limit = options?.limit ?? 200;

    const households = await ProactiveWhatsAppRepository.findEligibleHouseholds(db);
    const targetsToProcess = households.slice(0, limit);

    const payloads: ProactiveTargetPayload[] = [];

    for (const target of targetsToProcess) {
      const metrics = await ProactiveWhatsAppRepository.getWeeklyActivityMetrics(
        db,
        target.householdId,
        target.childId,
        sevenDaysAgo
      );

      const parameters = WeeklyDigestGenerator.generate(target, metrics);

      payloads.push({
        householdId: target.householdId,
        childId: target.childId,
        recipientPhone: target.parentPhone,
        templateName: 'appu_weekly_digest',
        templateLanguage: DEFAULT_TEMPLATE_LANGUAGE,
        parameters
      });
    }

    return payloads;
  }

  /**
   * Generates proactive payloads for the Daily Morning Tip (`appu_daily_tip`).
   * Delivers an age-adapted pedagogical tip rotated deterministically by date.
   */
  public static async generateDailyTip(
    db: Queryable,
    options?: ProactiveGenerateOptions
  ): Promise<ProactiveTargetPayload[]> {
    const referenceDate = options?.referenceDate || new Date();
    const limit = options?.limit ?? 200;

    const households = await ProactiveWhatsAppRepository.findEligibleHouseholds(db);
    const targetsToProcess = households.slice(0, limit);

    const payloads: ProactiveTargetPayload[] = [];

    for (const target of targetsToProcess) {
      const parameters = DailyTipGenerator.generate(target, referenceDate);

      payloads.push({
        householdId: target.householdId,
        childId: target.childId,
        recipientPhone: target.parentPhone,
        templateName: 'appu_daily_tip',
        templateLanguage: DEFAULT_TEMPLATE_LANGUAGE,
        parameters
      });
    }

    return payloads;
  }

  /**
   * Generates proactive payloads for Birthday Greetings (`appu_birthday_wish`).
   * Matches children whose dob month and day equal today's date in Asia/Kolkata timezone.
   */
  public static async generateBirthdayWishes(
    db: Queryable,
    options?: ProactiveGenerateOptions
  ): Promise<ProactiveTargetPayload[]> {
    const referenceDate = options?.referenceDate || new Date();
    const limit = options?.limit ?? 200;

    const birthdayChildren = await ProactiveWhatsAppRepository.findBirthdayTargetsToday(db, referenceDate);
    const targetsToProcess = birthdayChildren.slice(0, limit);

    const payloads: ProactiveTargetPayload[] = [];

    for (const target of targetsToProcess) {
      const parameters = BirthdayWishGenerator.generate(target);

      payloads.push({
        householdId: target.householdId,
        childId: target.childId,
        recipientPhone: target.parentPhone,
        templateName: 'appu_birthday_wish',
        templateLanguage: DEFAULT_TEMPLATE_LANGUAGE,
        parameters
      });
    }

    return payloads;
  }
}
