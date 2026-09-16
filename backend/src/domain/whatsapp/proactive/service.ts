import type { Queryable } from '../../../db/types.js';
import { ProactiveWhatsAppRepository } from './repository.js';
import {
  BirthdayWishGenerator,
  DailyTipGenerator,
  SessionAlertGenerator,
  WeeklyDigestGenerator
} from './generators.js';
import {
  DEFAULT_TEMPLATE_LANGUAGE,
  type ProactiveTargetPayload,
  type SessionAlertTargetPayload
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

  /**
   * Generates proactive payloads for Child Study Session Alerts:
   * - 'start': sessions created within the last ~8 minutes
   * - 'thirty': sessions created 30 to 40 minutes ago
   * Deduplicates strictly via `session_alerts` table.
   */
  public static async generateChildSessionAlerts(
    db: Queryable,
    options?: ProactiveGenerateOptions
  ): Promise<SessionAlertTargetPayload[]> {
    const referenceDate = options?.referenceDate || new Date();
    const limit = options?.limit ?? 200;
    const dryRun = Boolean(options?.dryRun);

    const candidates = await ProactiveWhatsAppRepository.findSessionAlertCandidates(db, {
      referenceDate,
      limit
    });

    const payloads: SessionAlertTargetPayload[] = [];
    const seenAlertKeys = new Set<string>();

    const refTime = referenceDate.getTime();
    const startMinTime = refTime - 8 * 60 * 1000;
    const thirtyMinTime = refTime - 40 * 60 * 1000;
    const thirtyMaxTime = refTime - 30 * 60 * 1000;

    for (const row of candidates) {
      const startedAt = row.started_at instanceof Date ? row.started_at : new Date(row.started_at);
      const startedTime = startedAt.getTime();

      let alertType: 'start' | 'thirty' | null = null;
      if (startedTime >= startMinTime && startedTime <= refTime && !row.start_sent_at) {
        alertType = 'start';
      } else if (startedTime >= thirtyMinTime && startedTime <= thirtyMaxTime && !row.thirty_sent_at) {
        alertType = 'thirty';
      }

      if (!alertType) continue;

      const alertKey = `${row.session_id}:${alertType}`;
      if (seenAlertKeys.has(alertKey)) continue;
      seenAlertKeys.add(alertKey);

      const recipientPhone = row.parent_phone.replace(/\D/g, '');
      if (!recipientPhone) continue;

      const templateName = alertType === 'start' ? 'appu_child_session_start' : 'appu_child_session_30min';
      const parameters = SessionAlertGenerator.generate(
        row.household_name,
        row.nickname,
        row.preferred_name
      );

      const payload: SessionAlertTargetPayload = {
        alertType,
        sessionId: row.session_id,
        recipientPhone,
        templateName,
        templateLanguage: DEFAULT_TEMPLATE_LANGUAGE,
        parameters
      };

      if (!dryRun) {
        await ProactiveWhatsAppRepository.recordSessionAlertSent(db, {
          sessionId: row.session_id,
          householdId: row.household_id,
          childId: row.child_id,
          startedAt,
          alertType,
          sentAt: referenceDate
        });
      }

      payloads.push(payload);
    }

    return payloads;
  }
}
